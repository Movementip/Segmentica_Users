import React from 'react';
import { withLayout } from '../../layout/Layout';
import { Htag } from '../../components';
import styles from './Logistics.module.css';

function LogisticsPage(): JSX.Element {
  return (
    <>
      <Htag tag="h1">Транспортные компании</Htag>
      <div className={styles.card}>
        <h2>Список ТК</h2>
        <p>Все транспортные компании и их тарифы</p>
        
        <div style={{ marginTop: '20px' }}>
          <h3>Функции:</h3>
          <ul>
            <li>Управление транспортными компаниями</li>
            <li>Контроль тарифов доставки</li>
            <li>Отслеживание отгрузок</li>
            <li>Номера отслеживания</li>
            <li>Статусы доставки</li>
          </ul>
        </div>
      </div>
      
      <div className={styles.card}>
        <h2>Активные отгрузки</h2>
        <p>Текущие отгрузки и их статусы</p>
      </div>
      
      <div className={styles.card}>
        <h2>Стоимость доставки</h2>
        <p>Анализ затрат на логистику</p>
      </div>
    </>
  );
}

export default withLayout(LogisticsPage);
