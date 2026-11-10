import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import Layout from './components/Layout';
import Splash from './components/Splash';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Tables from './pages/Tables';
import Menu from './pages/Menu';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Staff from './pages/Staff';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import './styles.css';

function App() {
  const [ready, setReady] = useState(false);
  return (
    <>
      {ready && <Routes_ />}
      {!ready && <Splash onDone={() => setReady(true)} />}
    </>
  );
}

const Routes_ = () => (
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="pos/:orderId" element={<POS />} />
            <Route path="orders" element={<Orders />} />
            <Route path="kitchen" element={<Kitchen />} />
            <Route path="tables" element={<Tables />} />
            <Route path="menu" element={<Menu />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="customers" element={<Customers />} />
            <Route path="staff" element={<Staff />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
