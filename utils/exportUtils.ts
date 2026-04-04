import * as XLSX from 'xlsx';

interface OrderPosition {
    id: number;
    товар_название: string;
    товар_артикул: string;
    количество: number;
    цена: number;
    сумма: number;
    товар_единица_измерения: string;
}

interface OrderDetail {
    id: number;
    дата_создания: string;
    клиент_название?: string;
    клиент_адрес?: string;
    общая_сумма: number;
    позиции: OrderPosition[];
    клиент_телефон?: string;
    клиент_email?: string;
    клиент_тип?: string;
    менеджер_фио?: string;
    менеджер_телефон?: string;
    статус: string;
    адрес_доставки?: string;
    дата_выполнения?: string;
    менеджер_id?: number;
    клиент_id: number;
    недостающие_товары?: any[];
}

declare global {
    interface Window {
        jsPDF: any;
    }
}




export const exportToExcel = (order: OrderDetail) => {
    const wb = XLSX.utils.book_new();

    // Format date
    const date = new Date(order.дата_создания).toLocaleDateString('ru-RU');

    // Create order info
    const orderInfo = [
        ['Заявка', `№${order.id}`],
        ['Дата', date],
        ['Клиент', order.клиент_название || 'Не указан'],
        ['Адрес', order.клиент_адрес || 'Не указан'],
        ['Статус', order.статус || 'Не указан'],
        ['', ''],
        ['Позиции', '', '', '', '', '', ''],
    ];

    // Add headers
    const headers = ['№', 'Наименование', 'Артикул', 'Кол-во', 'Ед. изм.', 'Цена', 'Сумма'];

    // Format positions
    const positions = order.позиции.map((item, index) => ({
        '№': index + 1,
        'Наименование': item.товар_название,
        'Артикул': item.товар_артикул,
        'Кол-во': item.количество,
        'Ед. изм.': item.товар_единица_измерения,
        'Цена': item.цена,
        'Сумма': item.сумма,
    }));

    // Add total
    const total = [
        { '': '', 'Наименование': 'Итого:', '': '', '': '', '': '', '': '', 'Сумма': order.общая_сумма }
    ];

    // Combine all data
    const ws_data = [
        ...orderInfo,
        headers,
        ...positions.map(p => Object.values(p)),
        [],
        ...total.map(t => Object.values(t))
    ];

    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Apply styles
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    // Header style
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = XLSX.utils.encode_cell({ r: 6, c: C }); // Changed from 5 to 6 to account for the extra row
        if (!ws[cell]) ws[cell] = {};
        ws[cell].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: '2980b9' } },
            color: { rgb: 'FFFFFF' }
        };
    }

    // Total style
    const totalRow = ws_data.length - 2;
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = XLSX.utils.encode_cell({ r: totalRow, c: C });
        if (ws[cell]) {
            ws[cell].s = { font: { bold: true } };
        }
    }

    // Set column widths
    ws['!cols'] = [
        { wch: 5 },  // №
        { wch: 40 }, // Наименование
        { wch: 15 }, // Артикул
        { wch: 10 }, // Кол-во
        { wch: 12 }, // Ед. изм.
        { wch: 12 }, // Цена
        { wch: 12 }, // Сумма
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Заявка ${order.id}`);
    XLSX.writeFile(wb, `Заявка_${order.id}_${date.replace(/\./g, '-')}.xlsx`);
};

export const exportToWord = (order: OrderDetail) => {
    // This is a simplified version. In a real app, you might want to use docx.js
    // or a similar library for more complex Word document generation.

    const date = new Date(order.дата_создания).toLocaleDateString('ru-RU');
    const total = order.общая_сумма.toLocaleString('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    // Function to convert number to words in Russian
    const numberToWords = (num: number): string => {
        const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
            'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать',
            'семнадцать', 'восемнадцать', 'девятнадцать'];
        const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят',
            'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
        const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот',
            'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

        const numStr = Math.floor(num).toString();
        const rubles = parseInt(numStr);
        const kopecks = Math.round((num - rubles) * 100);

        const convertLessThanThousand = (n: number): string => {
            if (n === 0) return '';
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
            return hundreds[Math.floor(n / 100)] + ' ' + convertLessThanThousand(n % 100);
        };

        const rublesText = convertLessThanThousand(rubles);
        const kopecksText = kopecks > 0 ? kopecks : '00';

        // Handle plural forms
        let rubleWord = 'рубль';
        const lastDigit = rubles % 10;
        const lastTwoDigits = rubles % 100;

        if (lastDigit === 1 && lastTwoDigits !== 11) {
            rubleWord = 'рубль';
        } else if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
            rubleWord = 'рубля';
        } else {
            rubleWord = 'рублей';
        }

        let kopeckWord = 'копеек';
        if (kopecks % 10 === 1 && kopecks % 100 !== 11) {
            kopeckWord = 'копейка';
        } else if ([2, 3, 4].includes(kopecks % 10) && ![12, 13, 14].includes(kopecks % 100)) {
            kopeckWord = 'копейки';
        }

        const amountInWords = `${rublesText} ${rubleWord} ${kopecks} ${kopeckWord}`
            .replace(/\s+/g, ' ') // Remove multiple spaces
            .trim();

        return amountInWords.charAt(0).toUpperCase() + amountInWords.slice(1);
    };

    // Format total amount
    const totalInWords = numberToWords(order.общая_сумма);
    const totalItems = order.позиции.length;

    // Create HTML content
    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Заявка №${order.id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #2c3e50; text-align: center; }
        .header { margin-bottom: 30px; }
        .info { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #f2f2f2; color: #333; padding: 10px; text-align: left; border: 1px solid #ddd; }
        td { padding: 10px; border: 1px solid #ddd; }
        .total { margin: 30px 0; font-size: 16px; }
        .signature { margin-top: 80px; }
        .signature-line { 
          display: inline-block; 
          width: 200px; 
          border-top: 1px solid #000; 
          margin: 5px 20px 0 0;
          position: relative;
          top: -5px;
        }
        .signature-label { 
          display: inline-block;
          width: 200px;
          margin-right: 20px;
        }
        .mt-4 { margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Заявка №${order.id}</h1>
        <p>Дата: ${date}</p>
        <p>Клиент: ${order.клиент_название}</p>
        <p>Адрес: ${order.клиент_адрес || 'Не указан'}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Наименование</th>
            <th>Артикул</th>
            <th>Кол-во</th>
            <th>Цена</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${order.позиции.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.товар_название}</td>
              <td>${item.товар_артикул}</td>
              <td>${item.количество} ${item.товар_единица_измерения}</td>
              <td>${item.цена.toLocaleString('ru-RU')} ₽</td>
              <td>${item.сумма.toLocaleString('ru-RU')} ₽</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="total">
        <p>Всего наименований ${totalItems} на сумму ${total}</p>

      </div>
      
      
      
      <div class="signature">
        <div>
          <span class="signature-label">Генеральный Директор</span>
          <span class="signature-line"></span>
          <span>(Юдин Р.И.)</span>
        </div>
        <div style="margin-top: 60px;">
          <span class="signature-label">Главный бухгалтер</span>
          <span class="signature-line"></span>
          <span>(Юдин Р.И.)</span>
        </div>
      </div>
    </body>
    </html>
  `;

    // Create blob and download
    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Заявка_${order.id}_${date.replace(/\./g, '-')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
