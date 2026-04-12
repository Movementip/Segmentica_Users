import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Progress, Text } from '@radix-ui/themes';
import { FiCheckCircle, FiChevronLeft, FiChevronRight, FiLock, FiX } from 'react-icons/fi';
import styles from './SystemGuidePopup.module.css';

export type SystemGuideStep = {
    id: string;
    section: string;
    title: string;
    caption: string;
    description: string;
    details?: string[];
    imageSrc: string;
    imageAlt: string;
};

type SystemGuidePopupProps = {
    open: boolean;
    steps: SystemGuideStep[];
    completed: boolean;
    furthestStep: number;
    onClose: () => void;
    onProgressChange: (state: { completed: boolean; furthestStep: number }) => void;
};

export function SystemGuidePopup({
    open,
    steps,
    completed,
    furthestStep,
    onClose,
    onProgressChange,
}: SystemGuidePopupProps): JSX.Element | null {
    const [portalReady, setPortalReady] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [localCompleted, setLocalCompleted] = useState(completed);
    const [localFurthestStep, setLocalFurthestStep] = useState(Math.min(Math.max(furthestStep, 0), Math.max(steps.length - 1, 0)));

    useEffect(() => {
        setPortalReady(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        const normalizedFurthest = Math.min(Math.max(furthestStep, 0), Math.max(steps.length - 1, 0));
        setLocalCompleted(completed);
        setLocalFurthestStep(normalizedFurthest);
        setCurrentStep(completed ? 0 : normalizedFurthest);
    }, [open, completed, furthestStep, steps.length]);

    useEffect(() => {
        if (!open) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && localCompleted) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, localCompleted, onClose]);

    const lastStepIndex = Math.max(steps.length - 1, 0);
    const current = steps[currentStep];

    const progressValue = useMemo(() => {
        if (steps.length === 0) return 0;
        const progressStep = localCompleted ? steps.length : localFurthestStep + 1;
        return Math.round((progressStep / steps.length) * 100);
    }, [localCompleted, localFurthestStep, steps.length]);

    if (!open || !current || !portalReady || typeof document === 'undefined') return null;

    const persistProgress = (nextStepIndex: number) => {
        const nextFurthest = Math.max(localFurthestStep, nextStepIndex);
        const reachedEnd = nextFurthest >= lastStepIndex;
        setLocalFurthestStep(nextFurthest);
        if (reachedEnd) {
            setLocalCompleted(true);
        }
        onProgressChange({
            completed: reachedEnd || localCompleted,
            furthestStep: nextFurthest,
        });
    };

    const goToStep = (index: number) => {
        if (index < 0 || index > lastStepIndex) return;
        if (!localCompleted && index > localFurthestStep + 1) return;
        setCurrentStep(index);
        if (index > localFurthestStep) {
            persistProgress(index);
        }
    };

    const handleNext = () => {
        if (currentStep >= lastStepIndex) return;
        goToStep(currentStep + 1);
    };

    const handlePrev = () => {
        if (currentStep <= 0) return;
        setCurrentStep((prev) => prev - 1);
    };

    const handleClose = () => {
        if (!localCompleted) return;
        onClose();
    };

    return createPortal(
        <div className={styles.overlay} onClick={localCompleted ? onClose : undefined}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="system-guide-title"
                onClick={(event) => event.stopPropagation()}
            >
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>
                        <Text size="2" weight="bold" className={styles.eyebrow}>
                            Подсказка по системе
                        </Text>
                        <h2 id="system-guide-title" className={styles.sidebarTitle}>
                            Гайд по системе
                        </h2>

                        <p className={styles.sidebarDescription}>
                            {localCompleted
                                ? 'Подсказка уже пройдена. Можно свободно перескакивать между разделами.'
                                : 'При первом знакомстве пройдите гайд последовательно. После этого его можно будет закрывать и открывать в любой момент.'}
                        </p>
                    </div>

                    <div className={styles.progressBlock}>
                        <div className={styles.progressHead}>
                            <span>Прогресс</span>
                            <span>{progressValue}%</span>
                        </div>
                        <Progress value={progressValue} size="2" radius="full" variant="soft" className={styles.progress} />
                        <div className={styles.progressMeta}>
                            Шаг {Math.min(currentStep + 1, steps.length)} из {steps.length}
                        </div>
                    </div>

                    <nav className={styles.legend} aria-label="Разделы подсказки">
                        {steps.map((step, index) => {
                            const isActive = index === currentStep;
                            const isVisited = index <= localFurthestStep;
                            const isAllowed = localCompleted || index <= localFurthestStep + 1;
                            const showSection = index === 0 || steps[index - 1]?.section !== step.section;

                            return (
                                <React.Fragment key={step.id}>
                                    {showSection && <div className={styles.legendSection}>{step.section}</div>}
                                    <button
                                        type="button"
                                        className={`${styles.legendItem} ${isActive ? styles.legendItemActive : ''}`}
                                        onClick={() => goToStep(index)}
                                        disabled={!isAllowed}
                                    >
                                        <span className={styles.legendBadge}>
                                            {isVisited ? <FiCheckCircle size={14} /> : index + 1}
                                        </span>
                                        <span className={styles.legendText}>
                                            <span className={styles.legendTitle}>{step.title}</span>
                                            <span className={styles.legendCaption}>{step.caption}</span>
                                        </span>
                                        {!isAllowed && <FiLock className={styles.legendLock} size={14} />}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </nav>
                </aside>

                <section className={styles.content}>
                    <div className={styles.contentHeader}>
                        <div>
                            <div className={styles.contentEyebrow}>{current.section} / {current.caption}</div>
                            <h3 className={styles.contentTitle}>{current.title}</h3>
                        </div>
                        <button
                            type="button"
                            className={`${styles.closeButton} ${!localCompleted ? styles.closeButtonDisabled : ''}`}
                            onClick={handleClose}
                            disabled={!localCompleted}
                            aria-label={localCompleted ? 'Закрыть подсказку' : 'Закрытие станет доступно после прохождения всех шагов'}
                            title={localCompleted ? 'Закрыть подсказку' : 'Пройдите подсказку до конца, чтобы закрыть её'}
                        >
                            <FiX size={20} />
                        </button>
                    </div>

                    <div className={styles.imageFrame}>
                        <img src={current.imageSrc} alt={current.imageAlt} className={styles.image} />
                    </div>

                    <div className={styles.textBlock}>
                        <p className={styles.text}>{current.description}</p>
                        {current.details?.length ? (
                            <ul className={styles.detailList}>
                                {current.details.map((detail) => (
                                    <li key={detail} className={styles.detailItem}>{detail}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>

                    <div className={styles.footer}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                        >
                            <FiChevronLeft size={18} />
                            Назад
                        </button>

                        <div className={styles.footerHint}>
                            {localCompleted
                                ? 'Подсказка завершена. Теперь её можно закрыть в любой момент.'
                                : currentStep === lastStepIndex
                                    ? 'Финишный шаг открыт. После него подсказку можно будет закрыть.'
                                    : 'Следующий пункт откроется после ручного перехода.'}
                        </div>

                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={currentStep === lastStepIndex ? handleClose : handleNext}
                            disabled={currentStep === lastStepIndex && !localCompleted}
                        >
                            {currentStep === lastStepIndex ? 'Завершить' : 'Дальше'}
                            {currentStep !== lastStepIndex && <FiChevronRight size={18} />}
                        </button>
                    </div>
                </section>
            </div>
        </div>,
        document.body
    );
}
