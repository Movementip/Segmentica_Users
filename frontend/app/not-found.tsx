export default function NotFound() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
            <div className="max-w-md text-center">
                <p className="text-sm font-medium text-muted-foreground">404</p>
                <h1 className="mt-2 text-3xl font-semibold">Страница не найдена</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Проверьте адрес или вернитесь в рабочий раздел CRM.
                </p>
            </div>
        </main>
    );
}
