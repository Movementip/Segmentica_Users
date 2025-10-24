import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

interface Category {
  id: number;
  название: string;
  описание?: string;
  родительская_категория_id?: number;
  активна: boolean;
  created_at: string;
}

interface CreateCategoryRequest {
  название: string;
  описание?: string;
  родительская_категория_id?: number;
}

interface UpdateCategoryRequest {
  id: number;
  название?: string;
  описание?: string;
  родительская_категория_id?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { id } = req.query;
    
    // If requesting a specific category by ID
    if (id && !Array.isArray(id)) {
      try {
        // Get category with parent category name
        const categoryResult = await query(`
          SELECT 
            c.*,
            p."название" as родительская_категория_название
          FROM "Категории_товаров" c
          LEFT JOIN "Категории_товаров" p ON c."родительская_категория_id" = p.id
          WHERE c.id = $1
        `, [id]);
        
        if (categoryResult.rows.length === 0) {
          return res.status(404).json({ error: 'Категория не найдена' });
        }
        
        const category = categoryResult.rows[0];
        
        // Get subcategories
        const subcategoriesResult = await query(
          'SELECT * FROM "Категории_товаров" WHERE "родительская_категория_id" = $1 AND активна = true ORDER BY "название"',
          [id]
        );
        
        // Get product count
        const productCountResult = await query(
          'SELECT COUNT(*) as count FROM "Товары" WHERE "категория_id" = $1',
          [id]
        );
        
        const detailedCategory = {
          ...category,
          подкатегории: subcategoriesResult.rows,
          товары: parseInt(productCountResult.rows[0].count)
        };
        
        res.status(200).json(detailedCategory);
      } catch (error) {
        console.error('Error fetching category detail:', error);
        res.status(500).json({ error: 'Ошибка получения детальной информации о категории' });
      }
      return;
    }
    
    try {
      // Get all active categories with parent category names
      const result = await query(`
        SELECT 
          c.id,
          c."название",
          c."описание",
          c."родительская_категория_id",
          p."название" as "родительская_категория_название",
          c."активна",
          c."created_at"
        FROM "Категории_товаров" c
        LEFT JOIN "Категории_товаров" p ON c."родительская_категория_id" = p.id
        WHERE c."активна" = true
        ORDER BY 
          COALESCE(c."родительская_категория_id", c.id),
          c."название"
      `);

      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Ошибка получения категорий' });
    }
  } else if (req.method === 'POST') {
    try {
      const { название, описание, родительская_категория_id }: CreateCategoryRequest = req.body;
      
      console.log('Received category data:', {
        название,
        описание,
        родительская_категория_id,
        typeOfParentId: typeof родительская_категория_id
      });

      if (!название) {
        return res.status(400).json({ error: 'Название категории обязательно' });
      }

      // Check if category with this name already exists (case-insensitive)
      const existingCategory = await query(
        'SELECT id FROM "Категории_товаров" WHERE LOWER("название") = LOWER($1) AND активна = true',
        [название]
      );

      if (existingCategory.rows.length > 0) {
        return res.status(400).json({ error: 'Категория с таким названием уже существует' });
      }

      // Validate parent category if provided
      if (родительская_категория_id) {
        const parentCategory = await query(
          'SELECT id FROM "Категории_товаров" WHERE id = $1 AND активна = true',
          [родительская_категория_id]
        );
        
        if (parentCategory.rows.length === 0) {
          return res.status(400).json({ error: 'Родительская категория не найдена' });
        }
      }

      // Create new category with proper error handling
      const result = await query(`
        INSERT INTO "Категории_товаров" (
          "название", "описание", "родительская_категория_id", "активна"
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, "название", "описание", "родительская_категория_id", "активна", created_at
      `, [
        название,
        описание || null,
        родительская_категория_id || null,
        true
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating category:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ 
        error: 'Ошибка создания категории: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, название, описание, родительская_категория_id }: UpdateCategoryRequest = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID категории обязателен' });
      }

      // Check if category exists
      const categoryCheck = await query(
        'SELECT id FROM "Категории_товаров" WHERE id = $1',
        [id]
      );

      if (categoryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }

      // Check if another category with this name already exists
      if (название) {
        const existingCategory = await query(
          'SELECT id FROM "Категории_товаров" WHERE LOWER("название") = LOWER($1) AND id != $2 AND активна = true',
          [название, id]
        );

        if (existingCategory.rows.length > 0) {
          return res.status(400).json({ error: 'Категория с таким названием уже существует' });
        }
      }

      // Validate parent category if provided
      if (родительская_категория_id) {
        const parentCategory = await query(
          'SELECT id FROM "Категории_товаров" WHERE id = $1 AND активна = true',
          [родительская_категория_id]
        );
        
        if (parentCategory.rows.length === 0) {
          return res.status(400).json({ error: 'Родительская категория не найдена' });
        }
      }

      // Update category
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (название !== undefined) {
        updateFields.push(`"название" = $${paramCount}`);
        values.push(название);
        paramCount++;
      }

      if (описание !== undefined) {
        updateFields.push(`"описание" = $${paramCount}`);
        values.push(описание);
        paramCount++;
      }

      if (родительская_категория_id !== undefined) {
        updateFields.push(`"родительская_категория_id" = $${paramCount}`);
        values.push(родительская_категория_id);
        paramCount++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
      }

      values.push(id);

      const result = await query(`
        UPDATE "Категории_товаров" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }

      // Return updated category with parent category name
      const updatedCategoryResult = await query(`
        SELECT 
          c.*,
          p."название" as родительская_категория_название
        FROM "Категории_товаров" c
        LEFT JOIN "Категории_товаров" p ON c."родительская_категория_id" = p.id
        WHERE c.id = $1
      `, [id]);

      res.status(200).json(updatedCategoryResult.rows[0]);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ 
        error: 'Ошибка обновления категории: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID категории обязателен' });
      }

      // Check if category exists and is active
      const categoryCheck = await query(
        'SELECT id, активна FROM "Категории_товаров" WHERE id = $1',
        [id]
      );

      if (categoryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }

      // If category is already inactive, return success
      if (!categoryCheck.rows[0].активна) {
        return res.status(200).json({ message: 'Категория уже удалена' });
      }

      // Check if category has child categories
      const childCategories = await query(
        'SELECT COUNT(*) as count FROM "Категории_товаров" WHERE "родительская_категория_id" = $1 AND активна = true',
        [id]
      );

      if (parseInt(childCategories.rows[0].count) > 0) {
        return res.status(400).json({ error: 'Нельзя удалить категорию, у которой есть подкатегории' });
      }

      // Check if category is used by products
      const productsCount = await query(
        'SELECT COUNT(*) as count FROM "Товары" WHERE "категория_id" = $1',
        [id]
      );

      if (parseInt(productsCount.rows[0].count) > 0) {
        return res.status(400).json({ error: 'Нельзя удалить категорию, к которой привязаны товары' });
      }

      // Soft delete the category
      await query(
        'UPDATE "Категории_товаров" SET активна = false WHERE id = $1',
        [id]
      );

      res.status(200).json({ message: 'Категория успешно удалена' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: 'Ошибка удаления категории' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}