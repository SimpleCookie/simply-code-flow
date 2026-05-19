import { Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Outlet />
    </div>
  );
}
