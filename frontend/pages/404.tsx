import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFoundPage(): JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: "16px",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>404 - Страница не найдена</h1>
        <p style={{ margin: 0, maxWidth: "520px" }}>
          Извините, но запрашиваемая вами страница не существует.
        </p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Вернуться на главную
        </Link>
      </div>
    </div>
  )
}
