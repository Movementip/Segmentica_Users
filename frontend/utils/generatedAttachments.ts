import type { AttachmentEntityType } from '../lib/attachmentPermissions';

export type GeneratedAttachmentTarget = {
    entityType: AttachmentEntityType;
    entityId: number | string;
    permScope?: string;
};

export type GeneratedAttachmentFile = {
    blob: Blob;
    fileName: string;
    mimeType?: string;
};

export const fetchGeneratedBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'Не удалось сформировать файл');
    }

    return response.blob();
};

export const uploadGeneratedAttachment = async (
    target: GeneratedAttachmentTarget,
    file: GeneratedAttachmentFile
): Promise<{ id: string | number }> => {
    const normalizedEntityId = Number(target.entityId);
    if (!Number.isInteger(normalizedEntityId) || normalizedEntityId <= 0) {
        throw new Error('Некорректный id сущности для сохранения документа');
    }

    const formData = new FormData();
    formData.append('entity_type', target.entityType);
    formData.append('entity_id', String(normalizedEntityId));

    if (target.permScope) {
        formData.append('perm_scope', target.permScope);
    }

    const uploadFile = new File([file.blob], file.fileName, {
        type: file.mimeType || file.blob.type || 'application/octet-stream',
    });
    formData.append('file', uploadFile);

    const response = await fetch('/api/attachments', {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });

    const payload = await response.json().catch(() => null) as { id?: string | number; error?: string } | null;

    if (!response.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить документ в реестр');
    }

    if (!payload?.id) {
        throw new Error('Документ сохранен, но сервер не вернул id вложения');
    }

    return { id: payload.id };
};

export const saveGeneratedAttachments = async (
    target: GeneratedAttachmentTarget,
    files: GeneratedAttachmentFile[]
): Promise<number> => {
    let savedCount = 0;

    for (const file of files) {
        await uploadGeneratedAttachment(target, file);
        savedCount += 1;
    }

    return savedCount;
};
