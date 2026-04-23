import { CreateEntityButton } from "@/components/CreateEntityButton/CreateEntityButton";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { ReferenceDataActions } from "@/components/reference-data/ReferenceDataActions/ReferenceDataActions";
import { RefreshButton } from "@/components/RefreshButton/RefreshButton";

import styles from "../Products.module.css";

type ProductsPageHeaderProps = {
    canCreate: boolean
    isRefreshing: boolean
    permissions?: string[]
    refreshClickKey: number
    onCreateProduct: () => void
    onImported: () => void | Promise<void>
    onRefresh: () => void
}

export function ProductsPageHeader({
    canCreate,
    isRefreshing,
    permissions,
    refreshClickKey,
    onCreateProduct,
    onImported,
    onRefresh,
}: ProductsPageHeaderProps) {
    return (
        <PageHeader
            title="Товары"
            subtitle="Каталог товаров и управление номенклатурой"
            actions={(
                <>
                    <RefreshButton
                        className={styles.surfaceButton}
                        isRefreshing={isRefreshing}
                        refreshKey={refreshClickKey}
                        iconClassName={styles.spinning}
                        onClick={(event) => {
                            event.currentTarget.blur();
                            onRefresh();
                        }}
                    />

                    <ReferenceDataActions
                        catalogKey="products"
                        permissions={permissions}
                        onImported={onImported}
                    />

                    {canCreate ? (
                        <CreateEntityButton className={styles.createButton} onClick={onCreateProduct}>
                            Добавить товар
                        </CreateEntityButton>
                    ) : null}
                </>
            )}
        />
    );
}
