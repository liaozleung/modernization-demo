import { Layout, Menu } from 'antd';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PartPage from './pages/PartPage';
import BomPage from './pages/BomPage';

const { Sider, Content, Header } = Layout;

const items = [
  { key: '/part', label: <Link to="/part">物料档案 (PART)</Link> },
  { key: '/bom',  label: <Link to="/bom">BOM</Link> },
];

export default function App() {
  const location = useLocation();
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light">
        <div style={{ padding: 16, fontWeight: 600 }}>粮裕 ERP — Demo</div>
        <Menu mode="inline" selectedKeys={[location.pathname.split('/').slice(0,2).join('/')]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 16 }}>
          物料 / BOM 模块 — schema 驱动通用 CRUD
        </Header>
        <Content style={{ padding: 16 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/part" replace />} />
            <Route path="/part" element={<PartPage />} />
            <Route path="/bom" element={<BomPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
