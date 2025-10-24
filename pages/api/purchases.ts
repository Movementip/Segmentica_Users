import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export interface CreatePurchaseRequest {
  поставщик_id: number;
  заявка_id?: number;
  дата_поступления?: string;
  статус: string;
  позиции: {
    товар_id: number;
    количество: number;
    цена: number;
  }[];
}

interface UpdatePurchaseRequest {
  id: number;
  статус?: string;
  дата_поступления?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      // If ID is provided, fetch single purchase with positions
      if (id) {
        // Get single purchase with supplier information
        const purchaseResult = await query(`
          SELECT 
            з.*,
            п."название" as поставщик_название,
            п."телефон" as поставщик_телефон,
            п."email" as поставщик_email
          FROM "Закупки" з
          LEFT JOIN "Поставщики" п ON з."поставщик_id" = п.id
          WHERE з.id = $1
        `, [id]);

        if (purchaseResult.rows.length === 0) {
          return res.status(404).json({ error: 'Закупка не найдена' });
        }

        const purchase = purchaseResult.rows[0];

        // Get purchase positions with product information
        const positionsResult = await query(`
          SELECT 
            пз.*,
            т."название" as товар_название,
            т."артикул" as товар_артикул
          FROM "Позиции_закупки" пз
          LEFT JOIN "Товары" т ON пз."товар_id" = т.id
          WHERE пз."закупка_id" = $1
        `, [id]);

        // Add calculated sum field to positions
        const positions = positionsResult.rows.map(position => ({
          ...position,
          сумма: position.количество * position.цена
        }));

        // Return purchase with positions
        res.status(200).json({
          ...purchase,
          позиции: positions
        });
      } else {
        // Get all purchases with supplier information
        const result = await query(`
          SELECT 
            з.*,
            п."название" as поставщик_название,
            п."телефон" as поставщик_телефон,
            п."email" as поставщик_email
          FROM "Закупки" з
          LEFT JOIN "Поставщики" п ON з."поставщик_id" = п.id
          ORDER BY з."дата_заказа" DESC
        `);

        res.status(200).json(result.rows);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
      res.status(500).json({ error: 'Failed to fetch purchases' });
    }
  } else if (req.method === 'POST') {
    try {
      const { поставщик_id, заявка_id, дата_поступления, статус, позиции }: CreatePurchaseRequest = req.body;

      // Validate required fields
      if (!поставщик_id || !статус || !позиции || позиции.length === 0) {
        return res.status(400).json({ 
          error: 'Поставщик, статус и позиции обязательны' 
        });
      }

      // Validate supplier exists
      const supplierCheck = await query(
        'SELECT id FROM "Поставщики" WHERE id = $1',
        [поставщик_id]
      );

      if (supplierCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Поставщик не найден' });
      }

      // Validate all products exist
      for (const position of позиции) {
        const productCheck = await query(
          'SELECT id FROM "Товары" WHERE id = $1',
          [position.товар_id]
        );

        if (productCheck.rows.length === 0) {
          return res.status(400).json({ 
            error: `Товар с ID ${position.товар_id} не найден` 
          });
        }
      }

      // Calculate total amount
      const общая_сумма = позиции.reduce((sum, pos) => sum + (pos.количество * pos.цена), 0);

      // Start transaction
      await query('BEGIN');

      try {
        // Create purchase
        const purchaseResult = await query(`
          INSERT INTO "Закупки" (
            "поставщик_id", "заявка_id", "дата_заказа", "дата_поступления", 
            "статус", "общая_сумма"
          ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
          RETURNING id
        `, [поставщик_id, заявка_id, дата_поступления, статус, общая_сумма]);

        const purchaseId = purchaseResult.rows[0].id;

        // Create purchase positions
        for (const position of позиции) {
          await query(`
            INSERT INTO "Позиции_закупки" (
              "закупка_id", "товар_id", "количество", "цена"
            ) VALUES ($1, $2, $3, $4)
          `, [purchaseId, position.товар_id, position.количество, position.цена]);

          // If purchase is received, update warehouse
          if (статус === 'получено') {
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
            `, [position.товар_id, position.количество, purchaseId]);
          }
        }

        // If this purchase is for a specific order, update missing products status
        if (заявка_id) {
          // Update status of missing products for this order
          for (const position of позиции) {
            // If purchase is received, update missing product status to "получено"
            if (статус === 'получено') {
              await query(`
                UPDATE "Недостающие_товары"
                SET "статус" = 'получено'
                WHERE "заявка_id" = $1 AND "товар_id" = $2
              `, [заявка_id, position.товар_id]);
            } 
            // If purchase is ordered, update missing product status to "заказано"
            else if (статус === 'заказано') {
              await query(`
                UPDATE "Недостающие_товары"
                SET "статус" = 'заказано'
                WHERE "заявка_id" = $1 AND "товар_id" = $2
              `, [заявка_id, position.товар_id]);
            }
          }
        }

        // Commit transaction
        await query('COMMIT');

        res.status(201).json({ 
          message: 'Закупка успешно создана',
          purchaseId,
          общая_сумма
        });
      } catch (transactionError) {
        // Rollback transaction on error
        await query('ROLLBACK');
        throw transactionError;
      }
    } catch (error) {
      console.error('Error creating purchase:', error);
      res.status(500).json({ 
        error: 'Ошибка создания закупки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { статус, дата_поступления }: UpdatePurchaseRequest = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID закупки обязателен' });
      }

      // Validate that either status or date is provided
      if (!статус && !дата_поступления) {
        return res.status(400).json({ error: 'Статус или дата поступления обязательны' });
      }

      // Start transaction
      await query('BEGIN');

      try {
        // Update purchase
        const updateFields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (статус) {
          updateFields.push(`"статус" = $${paramCount}`);
          values.push(статус);
          paramCount++;
        }

        if (дата_поступления) {
          updateFields.push(`"дата_поступления" = $${paramCount}`);
          values.push(дата_поступления);
          paramCount++;
        }

        values.push(id);

        const purchaseResult = await query(`
          UPDATE "Закупки"
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `, values);

        if (purchaseResult.rows.length === 0) {
          await query('ROLLBACK');
          return res.status(404).json({ error: 'Закупка не найдена' });
        }

        const updatedPurchase = purchaseResult.rows[0];

        // If status changed to "получено", update warehouse and missing products
        if (статус === 'получено') {
          // Get purchase positions
          const positionsResult = await query(`
            SELECT "товар_id", "количество"
            FROM "Позиции_закупки"
            WHERE "закупка_id" = $1
          `, [id]);

          // Update warehouse for each position
          for (const position of positionsResult.rows) {
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

            // Update missing product status to "получено" if this purchase is for a specific order
            if (updatedPurchase.заявка_id) {
              await query(`
                UPDATE "Недостающие_товары"
                SET "статус" = 'получено'
                WHERE "заявка_id" = $1 AND "товар_id" = $2
              `, [updatedPurchase.заявка_id, position.товар_id]);
            }
          }
        }

        // Commit transaction
        await query('COMMIT');

        res.status(200).json(updatedPurchase);
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
  } else if (req.method === 'DELETE') {
    try {
      if (!id) {
        return res.status(400).json({ error: 'ID закупки обязателен' });
      }

      // Delete purchase positions first (foreign key constraint)
      await query('DELETE FROM "Позиции_закупки" WHERE "закупка_id" = $1', [id]);
      
      // Delete purchase
      const result = await query('DELETE FROM "Закупки" WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Закупка не найдена' });
      }

      res.status(200).json({ message: 'Закупка успешно удалена' });
    } catch (error) {
      console.error('Error deleting purchase:', error);
      res.status(500).json({ error: 'Ошибка удаления закупки' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
  }
}