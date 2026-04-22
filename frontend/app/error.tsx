"use client";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
            <div className="max-w-md text-center">
                <p className="text-sm font-medium text-muted-foreground">Ошибка интерфейса</p>
                <h1 className="mt-2 text-3xl font-semibold">Не удалось открыть страницу</h1>
                <p className="mt-3 text-sm text-muted-foreground">{error.message || "Попробуйте обновить страницу."}</p>
                <button
                    type="button"
                    className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    onClick={reset}
                >
                    Повторить
                </button>
            </div>
        </main>
    );
}
