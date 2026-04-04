import io
import hashlib
import os
import shutil
import subprocess
import tempfile
import traceback
import unicodedata
from copy import copy
from pathlib import Path
from urllib.parse import quote

from flask import Flask, jsonify, request, send_file
from openpyxl import load_workbook
from openpyxl.cell.cell import MergedCell
from openpyxl.utils import (
    column_index_from_string,
    coordinate_to_tuple,
    get_column_letter,
    range_boundaries,
)
from openpyxl.worksheet.properties import PageSetupProperties


app = Flask(__name__)

TEMPLATES_DIR = Path(os.environ.get("TEMPLATES_DIR", "/app/templates/forms")).resolve()
LIBREOFFICE_BIN = os.environ.get("LIBREOFFICE_BIN", "/usr/bin/soffice")
LIBREOFFICE_TIMEOUT_MS = int(os.environ.get("LIBREOFFICE_TIMEOUT_MS", "30000"))
CACHE_DIR = Path(os.environ.get("DOCUMENT_RENDERER_CACHE_DIR", "/tmp/segmentica-render-cache")).resolve()
SUPPORTED_POSTPROCESS = {"none", "stack_pages_vertical"}


def to_ascii_filename(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = "".join(ch if ch.isalnum() or ch in {" ", ".", "-", "_", "(", ")"} else "_" for ch in ascii_only)
    cleaned = " ".join(cleaned.split()).strip(" .")
    return cleaned or "document"


def apply_download_filename(response, filename: str, as_attachment: bool = True):
    disposition = "attachment" if as_attachment else "inline"
    safe_filename = str(filename or "document").replace("\\", "_").replace('"', "'").replace("\r", " ").replace("\n", " ").strip()
    ascii_fallback = to_ascii_filename(safe_filename)
    encoded = quote(safe_filename, safe="")
    response.headers["Content-Disposition"] = (
        f"{disposition}; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"
    )
    return response


def ensure_template_path(template_name: str) -> Path:
    target = (TEMPLATES_DIR / template_name).resolve()
    if not str(target).startswith(str(TEMPLATES_DIR)):
        raise ValueError("Template path is outside templates directory")
    if not target.exists():
        raise FileNotFoundError(f"Template not found: {template_name}")
    return target


def load_workbook_with_fallback(template_path: Path):
    first_error = None
    try:
        workbook = load_workbook(template_path)
        if workbook.sheetnames:
            return workbook
        first_error = RuntimeError("openpyxl loaded workbook without visible sheets")
    except Exception as error:  # noqa: BLE001
        first_error = error

    temp_dir = Path(tempfile.mkdtemp(prefix="segmentica-template-normalize-"))
    try:
        proc = subprocess.run(
            [
                LIBREOFFICE_BIN,
                "--headless",
                "--nologo",
                "--nolockcheck",
                "--nodefault",
                "--norestore",
                "--convert-to",
                "xlsx",
                "--outdir",
                str(temp_dir),
                str(template_path),
            ],
            capture_output=True,
            text=True,
            timeout=LIBREOFFICE_TIMEOUT_MS / 1000,
            check=False,
        )

        if proc.returncode != 0:
            raise RuntimeError(
                f"LibreOffice normalize failed with code {proc.returncode}: {proc.stderr.strip() or proc.stdout.strip() or 'no output'}"
            ) from first_error

        normalized_path = temp_dir / f"{template_path.stem}.xlsx"
        if not normalized_path.exists():
            raise RuntimeError("LibreOffice did not produce a normalized XLSX file") from first_error

        workbook = load_workbook(normalized_path)
        if not workbook.sheetnames:
            raise RuntimeError("Normalized workbook still has no sheets") from first_error
        return workbook
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def copy_range_between_sheets(
    workbook,
    source_sheet_name: str,
    source_range: str,
    target_sheet_name: str,
    target_start_address: str,
) -> None:
    source_ws = workbook[source_sheet_name]
    target_ws = workbook[target_sheet_name]

    min_col, min_row, max_col, max_row = range_boundaries(source_range)
    target_col = column_index_from_string("".join(ch for ch in target_start_address if ch.isalpha()))
    target_row = int("".join(ch for ch in target_start_address if ch.isdigit()))
    row_offset = target_row - min_row
    col_offset = target_col - min_col

    for row in range(min_row, max_row + 1):
        if source_ws.row_dimensions[row].height is not None:
            target_ws.row_dimensions[row + row_offset].height = source_ws.row_dimensions[row].height
        target_ws.row_dimensions[row + row_offset].hidden = source_ws.row_dimensions[row].hidden

    for merged in list(target_ws.merged_cells.ranges):
        merged_min_col, merged_min_row, merged_max_col, merged_max_row = range_boundaries(str(merged))
        if (
            merged_min_row >= target_row
            and merged_max_row <= target_row + (max_row - min_row)
            and merged_min_col >= target_col
            and merged_max_col <= target_col + (max_col - min_col)
        ):
            target_ws.unmerge_cells(str(merged))

    for row in range(min_row, max_row + 1):
        for col in range(min_col, max_col + 1):
            source_cell = source_ws.cell(row=row, column=col)
            if isinstance(source_cell, MergedCell):
                continue
            target_cell = target_ws.cell(row=row + row_offset, column=col + col_offset)
            target_cell.value = source_cell.value
            target_cell.font = copy(source_cell.font)
            target_cell.fill = copy(source_cell.fill)
            target_cell.border = copy(source_cell.border)
            target_cell.alignment = copy(source_cell.alignment)
            target_cell.number_format = source_cell.number_format
            target_cell.protection = copy(source_cell.protection)
            target_cell._style = copy(source_cell._style)

    for merged in source_ws.merged_cells.ranges:
        merged_min_col, merged_min_row, merged_max_col, merged_max_row = range_boundaries(str(merged))
        if (
            merged_min_row >= min_row
            and merged_max_row <= max_row
            and merged_min_col >= min_col
            and merged_max_col <= max_col
        ):
            target_ws.merge_cells(
                start_row=merged_min_row + row_offset,
                start_column=merged_min_col + col_offset,
                end_row=merged_max_row + row_offset,
                end_column=merged_max_col + col_offset,
            )


def copy_sheet(workbook, source_sheet_name: str, target_sheet_name: str) -> None:
    if source_sheet_name not in workbook.sheetnames:
        return
    if target_sheet_name in workbook.sheetnames:
        return

    source_ws = workbook[source_sheet_name]
    cloned_ws = workbook.copy_worksheet(source_ws)
    cloned_ws.title = target_sheet_name


def get_writable_cell(worksheet, address: str):
    cell = worksheet[address]
    if not isinstance(cell, MergedCell):
        return cell

    row, col = coordinate_to_tuple(address)
    for merged in worksheet.merged_cells.ranges:
        min_col, min_row, max_col, max_row = range_boundaries(str(merged))
        if min_row <= row <= max_row and min_col <= col <= max_col:
            return worksheet.cell(row=min_row, column=min_col)

    return worksheet.cell(row=row, column=col)


def apply_cells_to_workbook(
    template_path: Path,
    output_path: Path,
    cells: list[dict],
    row_visibility: list[dict],
    row_heights: list[dict],
    print_areas: list[dict],
    range_copies: list[dict],
    sheet_copies: list[dict],
    hidden_sheets: list[str],
    sheet_page_setup: list[dict],
) -> None:
    workbook = load_workbook_with_fallback(template_path)

    for item in sheet_copies:
        source_sheet_name = str(item.get("sourceSheetName") or "").strip()
        target_sheet_name = str(item.get("targetSheetName") or "").strip()
        if not source_sheet_name or not target_sheet_name:
            continue
        copy_sheet(workbook, source_sheet_name, target_sheet_name)

    for item in range_copies:
        source_sheet_name = str(item.get("sourceSheetName") or "").strip()
        source_range = str(item.get("sourceRange") or "").strip()
        target_sheet_name = str(item.get("targetSheetName") or "").strip()
        target_start_address = str(item.get("targetStartAddress") or "").strip()
        if not source_sheet_name or not source_range or not target_sheet_name or not target_start_address:
            continue
        if source_sheet_name not in workbook.sheetnames or target_sheet_name not in workbook.sheetnames:
            continue
        copy_range_between_sheets(
            workbook,
            source_sheet_name,
            source_range,
            target_sheet_name,
            target_start_address,
        )

    for item in cells:
        address = str(item.get("address") or "").strip()
        if not address:
            continue
        sheet_name = str(item.get("sheetName") or "").strip()
        worksheet = workbook[sheet_name] if sheet_name and sheet_name in workbook.sheetnames else workbook[workbook.sheetnames[0]]
        cell = get_writable_cell(worksheet, address)
        cell.value = item.get("value")

        style = item.get("style") or {}
        if isinstance(style, dict) and style:
            font = copy(cell.font)
            alignment = copy(cell.alignment)

            if style.get("fontName"):
                font.name = str(style.get("fontName"))
            if style.get("fontSize") is not None:
                font.sz = float(style.get("fontSize"))
            if style.get("bold") is not None:
                font.bold = bool(style.get("bold"))

            if style.get("horizontal"):
                alignment.horizontal = str(style.get("horizontal"))
            if style.get("vertical"):
                alignment.vertical = str(style.get("vertical"))
            if style.get("wrapText") is not None:
                alignment.wrap_text = bool(style.get("wrapText"))
            if style.get("shrinkToFit") is not None:
                alignment.shrink_to_fit = bool(style.get("shrinkToFit"))

            cell.font = font
            cell.alignment = alignment

    for item in row_visibility:
        sheet_name = str(item.get("sheetName") or "").strip()
        row = int(item.get("row") or 0)
        hidden = bool(item.get("hidden"))
        if row <= 0:
            continue
        worksheet = workbook[sheet_name] if sheet_name and sheet_name in workbook.sheetnames else workbook[workbook.sheetnames[0]]
        worksheet.row_dimensions[row].hidden = hidden

    for item in row_heights:
        sheet_name = str(item.get("sheetName") or "").strip()
        row = int(item.get("row") or 0)
        height = item.get("height")
        if row <= 0 or height is None:
            continue
        worksheet = workbook[sheet_name] if sheet_name and sheet_name in workbook.sheetnames else workbook[workbook.sheetnames[0]]
        worksheet.row_dimensions[row].height = float(height)

    for item in print_areas:
        sheet_name = str(item.get("sheetName") or "").strip()
        area = str(item.get("range") or "").strip()
        if not area:
            continue
        worksheet = workbook[sheet_name] if sheet_name and sheet_name in workbook.sheetnames else workbook[workbook.sheetnames[0]]
        worksheet.print_area = area

    for sheet_name in list(hidden_sheets):
        if sheet_name in workbook.sheetnames and len(workbook.sheetnames) > 1:
            worksheet = workbook[sheet_name]
            workbook.remove(worksheet)

    page_setup_map = {}
    for item in sheet_page_setup:
        sheet_name = str(item.get("sheetName") or "").strip()
        if not sheet_name:
            continue
        page_setup_map[sheet_name] = {
            "fitToWidth": item.get("fitToWidth"),
            "fitToHeight": item.get("fitToHeight"),
        }

    for sheet in workbook.worksheets:
        # We want each Excel sheet to become one PDF page before stacking.
        # Otherwise LibreOffice preserves internal page breaks and we end up
        # stitching many fragmented pages instead of whole worksheets.
        sheet.sheet_view.view = "normal"
        if sheet.sheet_properties.pageSetUpPr is None:
            sheet.sheet_properties.pageSetUpPr = PageSetupProperties()
        sheet.sheet_properties.pageSetUpPr.fitToPage = True
        page_setup = page_setup_map.get(sheet.title, {})
        fit_to_width = page_setup.get("fitToWidth")
        fit_to_height = page_setup.get("fitToHeight")
        sheet.page_setup.fitToWidth = 1 if fit_to_width is None else int(fit_to_width)
        sheet.page_setup.fitToHeight = 1 if fit_to_height is None else int(fit_to_height)
        if not sheet.print_area:
            sheet.print_area = sheet.calculate_dimension()

    workbook.save(output_path)


def convert_to_pdf(input_path: Path, output_dir: Path) -> Path:
    user_installation_dir = output_dir / "lo-profile"
    user_installation_dir.mkdir(parents=True, exist_ok=True)

    proc = subprocess.run(
        [
            LIBREOFFICE_BIN,
            "--headless",
            "--nologo",
            "--nolockcheck",
            "--nodefault",
            "--norestore",
            f"-env:UserInstallation=file://{user_installation_dir}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(input_path),
        ],
        capture_output=True,
        text=True,
        timeout=LIBREOFFICE_TIMEOUT_MS / 1000,
        check=False,
    )

    if proc.returncode != 0:
        raise RuntimeError(
            f"LibreOffice convert failed with code {proc.returncode}: {proc.stderr.strip() or proc.stdout.strip() or 'no output'}"
        )

    pdf_path = output_dir / f"{input_path.stem}.pdf"
    if not pdf_path.exists():
        raise RuntimeError("LibreOffice did not produce a PDF file")
    return pdf_path


def ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def build_cache_key(xlsx_bytes: bytes, output_format: str, postprocess: str) -> str:
    digest = hashlib.sha256()
    digest.update(xlsx_bytes)
    digest.update(b"\0")
    digest.update(output_format.encode("utf-8"))
    digest.update(b"\0")
    digest.update(postprocess.encode("utf-8"))
    return digest.hexdigest()


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "templatesDir": str(TEMPLATES_DIR),
        "libreofficeBin": LIBREOFFICE_BIN,
    })


@app.post("/render/xlsx-template")
def render_xlsx_template():
    payload = request.get_json(silent=True) or {}
    template_name = str(payload.get("templateName") or "").strip()
    file_base_name = str(payload.get("fileBaseName") or "document").strip() or "document"
    output_format = str(payload.get("outputFormat") or "pdf").strip().lower()
    postprocess = str(payload.get("postprocess") or "").strip().lower()
    if not postprocess:
        postprocess = "stack_pages_vertical" if bool(payload.get("stackPages")) else "none"
    cells = payload.get("cells") or []
    row_visibility = payload.get("rowVisibility") or []
    row_heights = payload.get("rowHeights") or []
    print_areas = payload.get("printAreas") or []
    range_copies = payload.get("rangeCopies") or []
    sheet_copies = payload.get("sheetCopies") or []
    hidden_sheets = payload.get("hiddenSheets") or []
    sheet_page_setup = payload.get("sheetPageSetup") or []

    if not template_name:
        return jsonify({"error": "templateName is required"}), 400
    if output_format not in {"excel", "pdf"}:
        return jsonify({"error": "outputFormat must be excel or pdf"}), 400
    if postprocess not in SUPPORTED_POSTPROCESS:
        return jsonify({"error": "Unsupported postprocess"}), 400
    if not isinstance(cells, list):
        return jsonify({"error": "cells must be an array"}), 400
    if not isinstance(row_visibility, list):
        return jsonify({"error": "rowVisibility must be an array"}), 400
    if not isinstance(row_heights, list):
        return jsonify({"error": "rowHeights must be an array"}), 400
    if not isinstance(print_areas, list):
        return jsonify({"error": "printAreas must be an array"}), 400
    if not isinstance(range_copies, list):
        return jsonify({"error": "rangeCopies must be an array"}), 400
    if not isinstance(sheet_copies, list):
        return jsonify({"error": "sheetCopies must be an array"}), 400
    if not isinstance(hidden_sheets, list):
        return jsonify({"error": "hiddenSheets must be an array"}), 400
    if not isinstance(sheet_page_setup, list):
        return jsonify({"error": "sheetPageSetup must be an array"}), 400

    temp_dir = Path(tempfile.mkdtemp(prefix="segmentica-render-"))
    try:
        template_path = ensure_template_path(template_name)
        generated_xlsx = temp_dir / f"{file_base_name}.xlsx"
        apply_cells_to_workbook(
            template_path,
            generated_xlsx,
            cells,
            row_visibility,
            row_heights,
            print_areas,
            range_copies,
            sheet_copies,
            hidden_sheets,
            sheet_page_setup,
        )
        generated_xlsx_bytes = generated_xlsx.read_bytes()

        if output_format == "excel":
            response = send_file(
                io.BytesIO(generated_xlsx_bytes),
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name="document.xlsx",
            )
            return apply_download_filename(response, f"{file_base_name}.xlsx", as_attachment=True)

        ensure_cache_dir()
        cache_key = build_cache_key(generated_xlsx_bytes, output_format, postprocess)
        cached_pdf_path = CACHE_DIR / f"{cache_key}.pdf"
        if cached_pdf_path.exists():
            pdf_bytes = cached_pdf_path.read_bytes()
            response = send_file(
                io.BytesIO(pdf_bytes),
                mimetype="application/pdf",
                as_attachment=True,
                download_name="document.pdf",
            )
            return apply_download_filename(response, f"{file_base_name}.pdf", as_attachment=True)

        pdf_path = convert_to_pdf(generated_xlsx, temp_dir)
        final_pdf = pdf_path

        pdf_bytes = final_pdf.read_bytes()
        cached_pdf_path.write_bytes(pdf_bytes)
        response = send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="document.pdf",
        )
        return apply_download_filename(response, f"{file_base_name}.pdf", as_attachment=True)
    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    except Exception as error:
        traceback.print_exc()
        return jsonify({"error": str(error)}), 500
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    app.run(host="0.0.0.0", port=port)
