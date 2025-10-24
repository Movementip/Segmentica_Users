import { query } from './db';

/**
 * Check for missing products when creating or updating an order
 * This function compares the required quantities with available stock
 * and creates records in the "Недостающие_товары" table when needed
 */
export async function checkAndCreateMissingProducts(orderId: number) {
  try {
    // Get order positions
    const positionsResult = await query(`
      SELECT 
        pz."товар_id",
        pz."количество" as необходимое_количество,
        COALESCE(с."количество", 0) as доступное_количество
      FROM "Позиции_заявки" pz
      LEFT JOIN "Склад" с ON pz."товар_id" = с."товар_id"
      WHERE pz."заявка_id" = $1
    `, [orderId]);

    // For each position, check if there's enough stock
    for (const position of positionsResult.rows) {
      const { товар_id, необходимое_количество, доступное_количество } = position;
      const недостающее_количество = необходимое_количество - доступное_количество;

      // If there's not enough stock, create a missing product record
      if (недостающее_количество > 0) {
        try {
          await query(`
            INSERT INTO "Недостающие_товары" (
              "заявка_id", 
              "товар_id", 
              "необходимое_количество", 
              "недостающее_количество"
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT ("заявка_id", "товар_id") 
            DO UPDATE SET 
              "необходимое_количество" = EXCLUDED."необходимое_количество",
              "недостающее_количество" = EXCLUDED."недостающее_количество"
          `, [orderId, товар_id, необходимое_количество, недостающее_количество]);
        } catch (error) {
          console.error(`Error creating missing product record for order ${orderId}, product ${товар_id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error checking missing products for order ${orderId}:`, error);
  }
}

/**
 * Check for missing products for a specific product and quantity
 * Used when manually checking stock levels
 */
export async function checkMissingProduct(orderId: number, productId: number, requiredQuantity: number) {
  try {
    // Get available stock
    const stockResult = await query(`
      SELECT COALESCE("количество", 0) as доступное_количество
      FROM "Склад"
      WHERE "товар_id" = $1
    `, [productId]);

    const availableQuantity = stockResult.rows[0]?.доступное_количество || 0;
    const missingQuantity = requiredQuantity - availableQuantity;

    // If there's not enough stock, create or update a missing product record
    if (missingQuantity > 0) {
      const result = await query(`
        INSERT INTO "Недостающие_товары" (
          "заявка_id", 
          "товар_id", 
          "необходимое_количество", 
          "недостающее_количество"
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT ("заявка_id", "товар_id") 
        DO UPDATE SET 
          "необходимое_количество" = EXCLUDED."необходимое_количество",
          "недостающее_количество" = EXCLUDED."недостающее_количество"
        RETURNING *
      `, [orderId, productId, requiredQuantity, missingQuantity]);

      return result.rows[0];
    } else {
      // If there's enough stock now, we might want to remove the missing product record
      await query(`
        DELETE FROM "Недостающие_товары"
        WHERE "заявка_id" = $1 AND "товар_id" = $2
      `, [orderId, productId]);
      
      return null;
    }
  } catch (error) {
    console.error(`Error checking missing product for order ${orderId}, product ${productId}:`, error);
    throw error;
  }
}