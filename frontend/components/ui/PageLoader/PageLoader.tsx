import styles from './PageLoader.module.css';

type PageLoaderProps = {
    label?: string;
    fullPage?: boolean;
    className?: string;
};

export const PageLoader = ({
    label = 'Загрузка...',
    fullPage = false,
    className,
}: PageLoaderProps): JSX.Element => (
    <div
        className={[
            styles.loadingState,
            fullPage ? styles.fullPage : '',
            className || '',
        ].filter(Boolean).join(' ')}
        role="status"
        aria-live="polite"
    >
        <div className={styles.spinner} aria-hidden="true" />
        <p className={styles.label}>{label}</p>
    </div>
);
