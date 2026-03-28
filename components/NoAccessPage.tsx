import React from 'react';
import { Box, Text } from '@radix-ui/themes';

export function NoAccessPage({ title }: { title?: string }): JSX.Element {
    return (
        <div
            style={{
                padding: '2rem 1.5rem',
                paddingTop: 81,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                backgroundColor: '#fafafa',
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
            }}
        >
            <Box>
                <Text weight="bold" style={{ whiteSpace: 'pre-line' }}>{title || 'Нет доступа'}</Text>
            </Box>
        </div>
    );
}
