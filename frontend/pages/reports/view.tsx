import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { FiArrowLeft, FiDownload, FiFileText } from "react-icons/fi"
import * as XLSX from "xlsx"

import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import { EntityTableSurface, entityTableClassName } from "@/components/EntityDataTable/EntityDataTable"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { NoAccessPage } from "@/components/ui/NoAccessPage/NoAccessPage"
import { PageLoader } from "@/components/ui/PageLoader/PageLoader"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { withLayout } from "@/layout"
import {
    REPORT_EXPORT_EXCEL_PERMISSIONS,
    REPORT_EXPORT_WORD_PERMISSIONS,
    REPORT_VIEW_PERMISSIONS,
} from "@/lib/reportsRbac"
import { cn } from "@/lib/utils"
import type { ReportPeriod } from "@/types/pages/reports"
import { exportToWord } from "@/utils/exportUtils"

import styles from "./ReportView.module.css"

const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
    { value: "all", label: "Весь период" },
    { value: "6m", label: "Последние 6 месяцев" },
    { value: "3m", label: "Последние 3 месяца" },
    { value: "1m", label: "Последний месяц" },
]

function ReportViewer(): JSX.Element {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const { name, tab } = router.query

    const [data, setData] = useState<Array<Record<string, unknown>>>([])
    const [columns, setColumns] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [period, setPeriod] = useState<ReportPeriod>("6m")
    const [search, setSearch] = useState("")

    const reportTitle =
        typeof name === "string"
            ? name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
            : "Отчет"

    const backHref =
        typeof tab === "string" && tab.trim()
            ? `/reports?tab=${encodeURIComponent(tab)}`
            : "/reports?tab=custom"

    const viewPermissionKey = typeof name === "string" ? REPORT_VIEW_PERMISSIONS[name] : undefined
    const canViewReport = Boolean(viewPermissionKey && user?.permissions?.includes(viewPermissionKey))
    const canExportWord = Boolean(
        typeof name === "string" && user?.permissions?.includes(REPORT_EXPORT_WORD_PERMISSIONS[name])
    )
    const canExportExcel = Boolean(
        typeof name === "string" && user?.permissions?.includes(REPORT_EXPORT_EXCEL_PERMISSIONS[name])
    )

    const normalizedQuery = search.trim().toLowerCase()

    const dateColumnKey = useMemo(() => {
        if (!columns.length) return null
        return columns.find((key) => /дата|date/i.test(key)) || columns.find((key) => /_at$/i.test(key)) || null
    }, [columns])

    const isWithinPeriod = useCallback(
        (raw: unknown) => {
            if (period === "all") return true
            if (!raw) return true

            const date = new Date(String(raw))
            if (Number.isNaN(date.getTime())) return true

            const now = new Date()
            const months = period === "6m" ? 6 : period === "3m" ? 3 : 1
            const start = new Date(now)
            start.setMonth(start.getMonth() - months)
            return date >= start
        },
        [period]
    )

    const filteredData = useMemo(() => {
        if (!data.length) return []

        return data.filter((row) => {
            if (dateColumnKey && !isWithinPeriod(row[dateColumnKey])) return false
            if (!normalizedQuery) return true

            return columns.some((column) => {
                const value = row?.[column]
                if (value === null || value === undefined) return false
                return String(value).toLowerCase().includes(normalizedQuery)
            })
        })
    }, [columns, data, dateColumnKey, isWithinPeriod, normalizedQuery])

    useEffect(() => {
        if (!name || !canViewReport) return

        const fetchReportData = async () => {
            try {
                setLoading(true)
                setError("")

                const response = await fetch(`/api/reports/${name}`)
                if (!response.ok) {
                    throw new Error("Не удалось загрузить данные отчета")
                }

                const result = await response.json()
                if (result.data && result.data.length > 0) {
                    setData(result.data)
                    setColumns(Object.keys(result.data[0]))
                } else {
                    setData([])
                    setColumns([])
                }
            } catch (fetchError) {
                setError(
                    fetchError instanceof Error
                        ? fetchError.message
                        : "Произошла ошибка при загрузке отчета"
                )
            } finally {
                setLoading(false)
            }
        }

        void fetchReportData()
    }, [canViewReport, name])

    const formatValue = (value: unknown) => {
        if (value === null || value === undefined) return "-"
        if (typeof value === "string") {
            const trimmed = value.trim()

            if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const date = new Date(trimmed)
                if (!Number.isNaN(date.getTime())) {
                    return date.toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                    })
                }
            }

            if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
                const number = Number(trimmed)
                if (Number.isFinite(number)) {
                    const hasFraction = Math.abs(number % 1) > 1e-9
                    return new Intl.NumberFormat("ru-RU", {
                        maximumFractionDigits: hasFraction ? 2 : 0,
                    }).format(number)
                }
            }
        }

        if (typeof value === "number") {
            if (!Number.isFinite(value)) return String(value)
            const hasFraction = Math.abs(value % 1) > 1e-9
            return new Intl.NumberFormat("ru-RU", {
                maximumFractionDigits: hasFraction ? 2 : 0,
            }).format(value)
        }

        if (typeof value === "object") return JSON.stringify(value)
        return String(value)
    }

    const exportToExcel = () => {
        if (!filteredData.length) return

        const excelData = filteredData.map((row) => {
            const formattedRow: Record<string, string> = {}
            columns.forEach((column) => {
                formattedRow[column] = formatValue(row[column])
            })
            return formattedRow
        })

        const worksheet = XLSX.utils.json_to_sheet(excelData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет")

        const reportName = typeof name === "string" ? name : "report"
        XLSX.writeFile(workbook, `${reportName}_${new Date().toISOString().split("T")[0]}.xlsx`)
    }

    if (authLoading) {
        return <PageLoader label="Загрузка..." fullPage />
    }

    if (name && !canViewReport) {
        return <NoAccessPage />
    }

    if (loading) {
        return <PageLoader label="Загрузка отчета..." fullPage />
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>{error}</div>
                <Link href={backHref} className={styles.backLink}>
                    <FiArrowLeft /> Вернуться к списку отчетов
                </Link>
            </div>
        )
    }

    const renderEmptyRow = (message = "Нет данных для отображения") => (
        <TableRow>
            <TableCell colSpan={Math.max(1, columns.length)} className={styles.emptyRowCell}>
                <div className={styles.emptyRow}>{message}</div>
            </TableCell>
        </TableRow>
    )

    return (
        <div className={styles.container}>
            <PageHeader
                title={reportTitle}
                subtitle="Отчет из базы данных"
                actions={(
                    <>
                        <Select
                            value={period}
                            items={PERIOD_OPTIONS}
                            onValueChange={(nextValue) => setPeriod(nextValue as ReportPeriod)}
                        >
                            <SelectTrigger className={styles.periodSelect} />
                            <SelectContent>
                                {PERIOD_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <DataSearchField
                            wrapperClassName={styles.searchInput}
                            placeholder="Поиск по отчету..."
                            value={search}
                            onValueChange={setSearch}
                        />

                        <Button
                            type="button"
                            variant="outline"
                            className={styles.surfaceButton}
                            onClick={() => {
                                const wordData = {
                                    id: 0,
                                    дата_создания: new Date().toISOString(),
                                    клиент_название: "Отчет",
                                    общая_сумма: 0,
                                    статус: "Сформирован",
                                    клиент_id: 0,
                                    позиции: filteredData.map((row, index) => ({
                                        id: index + 1,
                                        товар_название: Object.values(row).join(" | "),
                                        товар_артикул: "",
                                        количество: 1,
                                        цена: 0,
                                        сумма: 0,
                                        товар_единица_измерения: "",
                                    })),
                                }

                                exportToWord(wordData)
                            }}
                            disabled={!canExportWord || filteredData.length === 0}
                        >
                            <FiFileText />
                            Word
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            className={styles.surfaceButton}
                            onClick={exportToExcel}
                            disabled={!canExportExcel || filteredData.length === 0}
                        >
                            <FiDownload />
                            Excel
                        </Button>

                        <Link href={backHref} className={styles.backActionLink}>
                            <Button type="button" variant="outline" className={styles.surfaceButton}>
                                <FiArrowLeft />
                                Назад
                            </Button>
                        </Link>
                    </>
                )}
            />

            <div className={styles.surface}>
                <EntityTableSurface variant="embedded" className={styles.tableSurface}>
                    <Table className={cn(entityTableClassName, styles.table)}>
                        <TableHeader>
                            <TableRow>
                                {columns.map((column) => (
                                    <TableHead key={column}>
                                        {column
                                            .split("_")
                                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                            .join(" ")}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length
                                ? filteredData.map((row, rowIndex) => (
                                    <TableRow key={rowIndex} className={styles.tableRow}>
                                        {columns.map((column) => {
                                            const cellValue = formatValue(row[column])
                                            return (
                                                <TableCell key={`${rowIndex}-${column}`} title={cellValue} className={styles.textCell}>
                                                    <div className={styles.cellContent}>{cellValue}</div>
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))
                                : renderEmptyRow()}
                        </TableBody>
                    </Table>
                </EntityTableSurface>
            </div>
        </div>
    )
}

export default withLayout(ReportViewer)
