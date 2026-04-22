import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requireAuth, requirePermission } from '../../lib/auth';

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
    активна?: boolean;
}

const syncCategoryIdSequence = async () => {
    await query(`
    SELECT setval(
      pg_get_serial_sequence('"Категории_товаров"', 'id'),
      COALESCE((SELECT MAX(id) FROM "Категории_товаров"), 1),
      true
    )
  `);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const { id } = req.query;

        const actor = await requirePermission(req, res, id ? 'categories.view' : 'categories.list');
        if (!actor) return;

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
                    'SELECT * FROM "Категории_товаров" WHERE "родительская_категория_id" = $1 ORDER BY "название"',
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
            // Get all categories with parent category names
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
        const actor = await requirePermission(req, res, 'categories.create');
        if (!actor) return;
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
                'SELECT id FROM "Категории_товаров" WHERE LOWER("название") = LOWER($1)',
                [название]
            );

            if (existingCategory.rows.length > 0) {
                return res.status(400).json({ error: 'Категория с таким названием уже существует' });
            }

            // Validate parent category if provided
            if (родительская_категория_id) {
                const parentCategory = await query(
                    'SELECT id FROM "Категории_товаров" WHERE id = $1',
                    [родительская_категория_id]
                );

                if (parentCategory.rows.length === 0) {
                    return res.status(400).json({ error: 'Родительская категория не найдена' });
                }
            }

            // Create new category with proper error handling
            await syncCategoryIdSequence();

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
        const body = (req.body || {}) as UpdateCategoryRequest;
        const isOnlyActiveToggle =
            body &&
            typeof body.id === 'number' &&
            body.активна !== undefined &&
            body.название === undefined &&
            body.описание === undefined &&
            body.родительская_категория_id === undefined;

        const actor = await requirePermission(req, res, isOnlyActiveToggle ? 'categories.disable' : 'categories.edit');
        if (!actor) return;
        try {
            const { id, название, описание, родительская_категория_id, активна }: UpdateCategoryRequest = body;

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
                    'SELECT id FROM "Категории_товаров" WHERE LOWER("название") = LOWER($1) AND id != $2',
                    [название, id]
                );

                if (existingCategory.rows.length > 0) {
                    return res.status(400).json({ error: 'Категория с таким названием уже существует' });
                }
            }

            // Validate parent category if provided
            if (родительская_категория_id) {
                const parentCategory = await query(
                    'SELECT id FROM "Категории_товаров" WHERE id = $1',
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

            if (активна !== undefined) {
                updateFields.push(`"активна" = $${paramCount}`);
                values.push(активна);
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
        const actor = await requirePermission(req, res, 'categories.delete');
        if (!actor) return;
        try {
            const { id } = req.query;

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

            // Check if category has child categories
            const childCategories = await query(
                'SELECT COUNT(*) as count FROM "Категории_товаров" WHERE "родительская_категория_id" = $1',
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

            // Hard delete the category
            await query(
                'DELETE FROM "Категории_товаров" WHERE id = $1',
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