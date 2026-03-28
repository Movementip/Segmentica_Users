import React from 'react';

export default function NotFoundPage(): JSX.Element {
    return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
            <h1>404 - Страница не найдена</h1>
            <p>Извините, но запрашиваемая вами страница не существует.</p>
        </div>
    );
}
