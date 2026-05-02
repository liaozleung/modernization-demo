import { Layout, Menu } from 'antd';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PartPage from './pages/PartPage';
import BomPage from './pages/BomPage';
import CustomerPage from './pages/CustomerPage';
import SoPage from './pages/SoPage';

const { Sider, Content, Header } = Layout;

const items = [
  { key: 'basic', label: '基础资料', type: 'group' as const, children: [
    { key: '/part',     label: <Link to="/part">物料档案</Link> },
    { key: '/customer', label: <Link to="/customer">客户档案</Link> },
  ]},
  { key: 'biz', label: '业务单据', type: 'group' as const, children: [
    { key: '/bom', label: <Link to="/bom">BOM</Link> },
    { key: '/so',  label: <Link to="/so">销售订单</Link> },
  ]},
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
          schema 驱动通用 CRUD — 1对1 / 1对多 共享 tsbase 基类
        </Header>
        <Content style={{ padding: 16 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/part" replace />} />
            <Route path="/part"     element={<PartPage />} />
            <Route path="/customer" element={<CustomerPage />} />
            <Route path="/bom"      element={<BomPage />} />
            <Route path="/so"       element={<SoPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
