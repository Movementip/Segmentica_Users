import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        // Check if the table exists
        const tableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'Недостающие_товары'
    `);

        if (tableCheck.rows.length === 0) {
            // Create the table with the correct structure
            await query(`
        CREATE TABLE IF NOT EXISTS public."Недостающие_товары"
        (
            id serial NOT NULL,
            "заявка_id" integer NOT NULL,
            "товар_id" integer NOT NULL,
            "необходимое_количество" integer NOT NULL,
            "недостающее_количество" integer NOT NULL,
            "статус" character varying(50) COLLATE pg_catalog."default" DEFAULT 'в обработке'::character varying,
            CONSTRAINT "Недостающие_товары_pkey" PRIMARY KEY (id),
            CONSTRAINT "Недостающие_тов_заявка_id_товар_id_key" UNIQUE ("заявка_id", "товар_id")
        );
      `);

            return res.status(200).json({
                message: 'Таблица Недостающие_товары создана успешно'
            });
        }

        // Check if the unique constraint exists
        const constraintCheck = await query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'Недостающие_товары' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'Недостающие_тов_заявка_id_товар_id_key'
    `);

        // Check if the default value exists
        const defaultCheck = await query(`
      SELECT column_name, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Недостающие_товары' 
      AND column_name = 'статус'
    `);

        const hasConstraint = constraintCheck.rows.length > 0;
        const hasDefault = defaultCheck.rows[0]?.column_default === "'в обработке'::character varying";

        // Add unique constraint if it doesn't exist
        if (!hasConstraint) {
            try {
                await query(`
          ALTER TABLE "Недостающие_товары"
          ADD CONSTRAINT "Недостающие_тов_заявка_id_товар_id_key" UNIQUE ("заявка_id", "товар_id")
        `);
            } catch (error) {
                console.log('Constraint may already exist or another error occurred:', error);
            }
        }

        // Add default value if it doesn't exist
        if (!hasDefault) {
            try {
                await query(`
          ALTER TABLE "Недостающие_товары"
          ALTER COLUMN "статус" SET DEFAULT 'в обработке'::character varying
        `);
            } catch (error) {
                console.log('Default value may already exist or another error occurred:', error);
            }
        }

        // Get table structure
        const columns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Недостающие_товары'
    `);

        res.status(200).json({
            message: 'Таблица Недостающие_товары найдена и обновлена при необходимости',
            columns: columns.rows,
            constraintAdded: !hasConstraint,
            defaultAdded: !hasDefault
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            error: 'Ошибка подключения к базе данных: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
        });
    }
}