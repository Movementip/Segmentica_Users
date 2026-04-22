"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="ru">
            <body>
                <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
                    <div className="max-w-md text-center">
                        <p className="text-sm font-medium text-muted-foreground">Критическая ошибка</p>
                        <h1 className="mt-2 text-3xl font-semibold">Интерфейс временно недоступен</h1>
                        <p className="mt-3 text-sm text-muted-foreground">
                            {error.message || "Попробуйте перезагрузить страницу."}
                        </p>
                        <button
                            type="button"
                            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                            onClick={reset}
                        >
                            Повторить
                        </button>
                    </div>
                </main>
            </body>
        </html>
    );
}
