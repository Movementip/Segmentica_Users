import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { ManagerHrProfile } from "@/lib/managerHr"

import styles from "./ManagerHrSections.module.css"

type ManagerHrBankSectionProps = {
  bank: ManagerHrProfile["bank"]
  readOnly: boolean
  onPatchBank: (patch: Partial<ManagerHrProfile["bank"]>) => void
}

export function ManagerHrBankSection({
  bank,
  readOnly,
  onPatchBank,
}: ManagerHrBankSectionProps) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.cardTitle}>Банковские данные</CardTitle>
      </CardHeader>
      <CardContent className={styles.cardContent}>
        <div className={styles.formGrid2}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-name">Банк</Label>
            <Input id="manager-bank-name" className={styles.input} value={bank.bankName} onChange={(e) => onPatchBank({ bankName: e.target.value })} disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-bik">БИК</Label>
            <Input id="manager-bank-bik" className={styles.input} value={bank.bankBik} onChange={(e) => onPatchBank({ bankBik: e.target.value })} disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-settlement">Расчетный счет</Label>
            <Input id="manager-bank-settlement" className={styles.input} value={bank.settlementAccount} onChange={(e) => onPatchBank({ settlementAccount: e.target.value })} disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-correspondent">Корреспондентский счет</Label>
            <Input id="manager-bank-correspondent" className={styles.input} value={bank.correspondentAccount} onChange={(e) => onPatchBank({ correspondentAccount: e.target.value })} disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-mir">Карта МИР</Label>
            <Input id="manager-bank-mir" className={styles.input} value={bank.mirCardNumber} onChange={(e) => onPatchBank({ mirCardNumber: e.target.value })} disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-alt-name">Иная организация</Label>
            <Input id="manager-bank-alt-name" className={styles.input} value={bank.alternativeBankName} onChange={(e) => onPatchBank({ alternativeBankName: e.target.value })} disabled={readOnly} />
          </div>
          <div className={`${styles.field} ${styles.spanAll}`}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-alt-account">Счет в иной организации</Label>
            <Input id="manager-bank-alt-account" className={styles.input} value={bank.alternativeAccountNumber} onChange={(e) => onPatchBank({ alternativeAccountNumber: e.target.value })} disabled={readOnly} />
          </div>
          <div className={`${styles.field} ${styles.spanAll}`}>
            <Label className={styles.fieldLabel} htmlFor="manager-bank-notes">Комментарий</Label>
            <Textarea id="manager-bank-notes" className={styles.textarea} value={bank.notes} onChange={(e) => onPatchBank({ notes: e.target.value })} disabled={readOnly} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
