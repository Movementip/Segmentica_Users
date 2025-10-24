import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export interface Product {
  id: number;
  название: string;
  артикул: string;
  категория?: string;
  цена_закупки?: number;
  цена_продажи: number;
  единица_измерения: string;
  минимальный_остаток: number;
  created_at: string;
  категория_id?: number;
}

interface CreateProductRequest {
  название: string;
  артикул: string;
  категория?: string;
  цена_закупки?: number;
  цена_продажи: number;
  единица_измерения?: string;
  минимальный_остаток?: number;
  категория_id?: number;
}

interface UpdateProductRequest {
  id: number;
  название?: string;
  артикул?: string;
  категория?: string;
  цена_закупки?: number;
  цена_продажи?: number;
  единица_измерения?: string;
  минимальный_остаток?: number;
  категория_id?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Product[] | Product | { error: string } | { message: string }>
) {
  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      
      if (id) {
        // Fetch single product by ID
        const result = await query(
          'SELECT * FROM "Товары" WHERE id = $1',
          [id]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Товар не найден' });
        }
        
        const product: Product = {
          id: result.rows[0].id,
          название: result.rows[0].название,
          артикул: result.rows[0].артикул,
          категория: result.rows[0].категория,
          цена_закупки: result.rows[0].цена_закупки ? parseFloat(result.rows[0].цена_закупки) : undefined,
          цена_продажи: parseFloat(result.rows[0].цена_продажи) || 0,
          единица_измерения: result.rows[0].единица_измерения,
          минимальный_остаток: result.rows[0].минимальный_остаток,
          created_at: result.rows[0].created_at,
          категория_id: result.rows[0].категория_id
        };
        
        res.status(200).json(product);
      } else {
        // Fetch all products
        const result = await query(`
          SELECT * FROM "Товары"
          ORDER BY "название"
        `);
        
        const products: Product[] = result.rows.map((row: any) => ({
          id: row.id,
          название: row.название,
          артикул: row.артикул,
          категория: row.категория,
          цена_закупки: row.цена_закупки ? parseFloat(row.цена_закупки) : undefined,
          цена_продажи: parseFloat(row.цена_продажи) || 0,
          единица_измерения: row.единица_измерения,
          минимальный_остаток: row.минимальный_остаток,
          created_at: row.created_at,
          категория_id: row.категория_id
        }));
        
        res.status(200).json(products);
      }
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ 
        error: 'Ошибка получения товаров: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  } else if (req.method === 'POST') {
    try {
      const { название, артикул, категория, цена_закупки, цена_продажи, единица_измерения, минимальный_остаток, категория_id }: CreateProductRequest = req.body;

      // Validate required fields
      if (!название || !артикул || !цена_продажи) {
        return res.status(400).json({ error: 'Название, артикул и цена продажи обязательны' });
      }

      // Check if product with this article already exists
      const existingProduct = await query(
        'SELECT id FROM "Товары" WHERE "артикул" = $1',
        [артикул]
      );

      if (existingProduct.rows.length > 0) {
        return res.status(400).json({ error: 'Товар с таким артикулом уже существует' });
      }

      // Create new product
      const result = await query(`
        INSERT INTO "Товары" ("название", "артикул", "категория", "цена_закупки", "цена_продажи", "единица_измерения", "минимальный_остаток", "категория_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [название, артикул, категория || null, цена_закупки || null, цена_продажи, единица_измерения || 'шт', минимальный_остаток || 0, категория_id || null]);

      const newProduct: Product = {
        id: result.rows[0].id,
        название: result.rows[0].название,
        артикул: result.rows[0].артикул,
        категория: result.rows[0].категория,
        цена_закупки: result.rows[0].цена_закупки ? parseFloat(result.rows[0].цена_закупки) : undefined,
        цена_продажи: parseFloat(result.rows[0].цена_продажи) || 0,
        единица_измерения: result.rows[0].единица_измерения,
        минимальный_остаток: result.rows[0].минимальный_остаток,
        created_at: result.rows[0].created_at,
        категория_id: result.rows[0].категория_id
      };

      res.status(201).json(newProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ 
        error: 'Ошибка создания товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, название, артикул, категория, цена_закупки, цена_продажи, единица_измерения, минимальный_остаток, категория_id }: UpdateProductRequest = req.body;

      // Validate required fields
      if (!id) {
        return res.status(400).json({ error: 'ID товара обязателен' });
      }

      // Check if product exists
      const productCheck = await query(
        'SELECT id FROM "Товары" WHERE id = $1',
        [id]
      );

      if (productCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      // Check if another product with this article already exists
      if (артикул) {
        const existingProduct = await query(
          'SELECT id FROM "Товары" WHERE "артикул" = $1 AND id != $2',
          [артикул, id]
        );

        if (existingProduct.rows.length > 0) {
          return res.status(400).json({ error: 'Товар с таким артикулом уже существует' });
        }
      }

      // Update product
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (название !== undefined) {
        updateFields.push(`"название" = $${paramCount}`);
        values.push(название);
        paramCount++;
      }

      if (артикул !== undefined) {
        updateFields.push(`"артикул" = $${paramCount}`);
        values.push(артикул);
        paramCount++;
      }

      if (категория !== undefined) {
        updateFields.push(`"категория" = $${paramCount}`);
        values.push(категория);
        paramCount++;
      }

      if (цена_закупки !== undefined) {
        updateFields.push(`"цена_закупки" = $${paramCount}`);
        values.push(цена_закупки);
        paramCount++;
      }

      if (цена_продажи !== undefined) {
        updateFields.push(`"цена_продажи" = $${paramCount}`);
        values.push(цена_продажи);
        paramCount++;
      }

      if (единица_измерения !== undefined) {
        updateFields.push(`"единица_измерения" = $${paramCount}`);
        values.push(единица_измерения);
        paramCount++;
      }

      if (минимальный_остаток !== undefined) {
        updateFields.push(`"минимальный_остаток" = $${paramCount}`);
        values.push(минимальный_остаток);
        paramCount++;
      }

      if (категория_id !== undefined) {
        updateFields.push(`"категория_id" = $${paramCount}`);
        values.push(категория_id);
        paramCount++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
      }

      values.push(id);

      const result = await query(`
        UPDATE "Товары" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      const updatedProduct: Product = {
        id: result.rows[0].id,
        название: result.rows[0].название,
        артикул: result.rows[0].артикул,
        категория: result.rows[0].категория,
        цена_закупки: result.rows[0].цена_закупки ? parseFloat(result.rows[0].цена_закупки) : undefined,
        цена_продажи: parseFloat(result.rows[0].цена_продажи) || 0,
        единица_измерения: result.rows[0].единица_измерения,
        минимальный_остаток: result.rows[0].минимальный_остаток,
        created_at: result.rows[0].created_at,
        категория_id: result.rows[0].категория_id
      };

      res.status(200).json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ 
        error: 'Ошибка обновления товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID товара обязателен' });
      }

      // Check if product exists
      const productCheck = await query(
        'SELECT id FROM "Товары" WHERE id = $1',
        [id]
      );

      if (productCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      // Check if product is used in any positions
      const positionsCheck1 = await query(
        'SELECT COUNT(*) as count FROM "Позиции_заявки" WHERE "товар_id" = $1',
        [id]
      );

      const positionsCheck2 = await query(
        'SELECT COUNT(*) as count FROM "Позиции_закупки" WHERE "товар_id" = $1',
        [id]
      );

      const positionsCheck3 = await query(
        'SELECT COUNT(*) as count FROM "Ассортимент_поставщиков" WHERE "товар_id" = $1',
        [id]
      );

      const totalPositions = parseInt(positionsCheck1.rows[0].count) + 
                            parseInt(positionsCheck2.rows[0].count) + 
                            parseInt(positionsCheck3.rows[0].count);

      if (totalPositions > 0) {
        return res.status(400).json({ error: 'Нельзя удалить товар, который используется в заявках, закупках или ассортименте поставщиков' });
      }

      // Delete product
      await query('DELETE FROM "Товары" WHERE id = $1', [id]);

      res.status(200).json({ message: 'Товар успешно удален' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ 
        error: 'Ошибка удаления товара: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
  }
}