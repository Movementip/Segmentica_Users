import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export interface PurchaseDetail {
  id: number;
  поставщик_id: number;
  заявка_id?: number;
  дата_заказа: string;
  дата_поступления?: string;
  статус: string;
  общая_сумма: number;
  поставщик_название: string;
  поставщик_телефон?: string;
  поставщик_email?: string;
  заявка_клиент?: string;
  позиции: PurchasePosition[];
}

export interface PurchasePosition {
  id: number;
  товар_id: number;
  количество: number;
  цена: number;
  сумма: number;
  товар_название: string;
  товар_артикул: string;
  товар_категория?: string;
  товар_единица_измерения: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PurchaseDetail | { error: string } | { message: string }>
) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      // Получаем основную информацию о закупке
      const purchaseResult = await query(`
        SELECT 
          з.*,
          п."название" as поставщик_название,
          п."телефон" as поставщик_телефон,
          п."email" as поставщик_email,
          к."название" as заявка_клиент
        FROM "Закупки" з
        LEFT JOIN "Поставщики" п ON з."поставщик_id" = п.id
        LEFT JOIN "Заявки" заяв ON з."заявка_id" = заяв.id
        LEFT JOIN "Клиенты" к ON заяв."клиент_id" = к.id
        WHERE з.id = $1
      `, [id]);

      if (purchaseResult.rows.length === 0) {
        return res.status(404).json({ error: 'Закупка не найдена' });
      }

      const purchase = purchaseResult.rows[0];

      // Получаем позиции закупки
      const positionsResult = await query(`
        SELECT 
          пз.*,
          пз."количество" * пз."цена" as сумма,
          т."название" as товар_название,
          т."артикул" as товар_артикул,
          т."категория" as товар_категория,
          т."единица_измерения" as товар_единица_измерения
        FROM "Позиции_закупки" пз
        LEFT JOIN "Товары" т ON пз."товар_id" = т.id
        WHERE пз."закупка_id" = $1
        ORDER BY пз.id
      `, [id]);

      const positions: PurchasePosition[] = positionsResult.rows.map((row: any) => ({
        id: row.id,
        товар_id: row.товар_id,
        количество: row.количество,
        цена: parseFloat(row.цена),
        сумма: parseFloat(row.сумма),
        товар_название: row.товар_название,
        товар_артикул: row.товар_артикул,
        товар_категория: row.товар_категория,
        товар_единица_измерения: row.товар_единица_измерения || 'шт'
      }));

      const purchaseDetail: PurchaseDetail = {
        id: purchase.id,
        поставщик_id: purchase.поставщик_id,
        заявка_id: purchase.заявка_id,
        дата_заказа: purchase.дата_заказа,
        дата_поступления: purchase.дата_поступления,
        статус: purchase.статус,
        общая_сумма: parseFloat(purchase.общая_сумма) || 0,
        поставщик_название: purchase.поставщик_название,
        поставщик_телефон: purchase.поставщик_телефон,
        поставщик_email: purchase.поставщик_email,
        заявка_клиент: purchase.заявка_клиент,
        позиции: positions
      };

      res.status(200).json(purchaseDetail);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ 
        error: 'Ошибка получения детальной информации о закупке: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  } else if (req.method === 'PUT') {
    // Update purchase status
    try {
      const { статус, дата_поступления } = req.body;

      if (!статус) {
        return res.status(400).json({ error: 'Статус обязателен' });
      }

      // Validate status
      const validStatuses = ['заказано', 'в пути', 'получено', 'отменено'];
      if (!validStatuses.includes(статус.toLowerCase())) {
        return res.status(400).json({ 
          error: 'Недопустимый статус. Допустимые значения: ' + validStatuses.join(', ') 
        });
      }

      // Check if purchase exists
      const purchaseCheck = await query(
        'SELECT * FROM "Закупки" WHERE id = $1',
        [id]
      );

      if (purchaseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Закупка не найдена' });
      }

      const existingPurchase = purchaseCheck.rows[0];
      const wasReceived = existingPurchase.статус === 'получено';
      const willBeReceived = статус === 'получено';

      // Start transaction
      await query('BEGIN');

      try {
        // Update purchase status
        const updateData: any[] = [статус, id];
        let updateQuery = 'UPDATE "Закупки" SET "статус" = $1';
        
        if (дата_поступления) {
          updateQuery += ', "дата_поступления" = $3';
          updateData.splice(1, 0, дата_поступления);
        } else if (willBeReceived && !existingPurchase.дата_поступления) {
          updateQuery += ', "дата_поступления" = CURRENT_TIMESTAMP';
        }
        
        updateQuery += ' WHERE id = $' + updateData.length;
        
        await query(updateQuery, updateData);

        // Handle warehouse updates when status changes to/from 'получено'
        if (!wasReceived && willBeReceived) {
          // Purchase is being marked as received - add to warehouse
          const positions = await query(
            'SELECT * FROM "Позиции_закупки" WHERE "закупка_id" = $1',
            [id]
          );

          for (const position of positions.rows) {
            // Check if product exists in warehouse
            const warehouseCheck = await query(
              'SELECT * FROM "Склад" WHERE "товар_id" = $1',
              [position.товар_id]
            );

            if (warehouseCheck.rows.length > 0) {
              // Update existing warehouse record
              await query(`
                UPDATE "Склад" 
                SET "количество" = "количество" + $1,
                    "дата_последнего_поступления" = CURRENT_TIMESTAMP
                WHERE "товар_id" = $2
              `, [position.количество, position.товар_id]);
            } else {
              // Create new warehouse record
              await query(`
                INSERT INTO "Склад" ("товар_id", "количество", "дата_последнего_поступления")
                VALUES ($1, $2, CURRENT_TIMESTAMP)
              `, [position.товар_id, position.количество]);
            }

            // Create warehouse movement record
            await query(`
              INSERT INTO "Движения_склада" (
                "товар_id", "тип_операции", "количество", "дата_операции", "закупка_id"
              ) VALUES ($1, 'приход', $2, CURRENT_TIMESTAMP, $3)
            `, [position.товар_id, position.количество, id]);
          }
        } else if (wasReceived && !willBeReceived) {
          // Purchase is being changed from received - remove from warehouse
          const positions = await query(
            'SELECT * FROM "Позиции_закупки" WHERE "закупка_id" = $1',
            [id]
          );

          for (const position of positions.rows) {
            // Check current warehouse quantity
            const warehouseCheck = await query(
              'SELECT * FROM "Склад" WHERE "товар_id" = $1',
              [position.товар_id]
            );

            if (warehouseCheck.rows.length > 0) {
              const currentQuantity = warehouseCheck.rows[0].количество;
              if (currentQuantity >= position.количество) {
                // Update warehouse quantity
                await query(`
                  UPDATE "Склад" 
                  SET "количество" = "количество" - $1
                  WHERE "товар_id" = $2
                `, [position.количество, position.товар_id]);

                // Create warehouse movement record
                await query(`
                  INSERT INTO "Движения_склада" (
                    "товар_id", "тип_операции", "количество", "дата_операции", "закупка_id"
                  ) VALUES ($1, 'расход', $2, CURRENT_TIMESTAMP, $3)
                `, [position.товар_id, position.количество, id]);
              }
            }
          }
        }

        // Commit transaction
        await query('COMMIT');

        res.status(200).json({ message: 'Статус закупки успешно обновлен' });
      } catch (transactionError) {
        // Rollback transaction on error
        await query('ROLLBACK');
        throw transactionError;
      }
    } catch (error) {
      console.error('Error updating purchase:', error);
      res.status(500).json({ 
        error: 'Ошибка обновления закупки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
  }
}