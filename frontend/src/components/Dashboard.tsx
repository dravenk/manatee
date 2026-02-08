/**
 * Dashboard 主布局组件
 */

import { useState, useEffect } from 'react';
import { Wallet, ShoppingCart, LogOut, User, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { WalletPage } from './pages/WalletPage';
import { OrderPage } from './pages/OrderPage';
import { LoginPage } from './LoginPage';
import { Settings as SettingsComponent } from './Settings';
import { Button } from './ui/button';
import { verifySession, logout } from '../lib/api/auth';

type Page = 'wallet' | 'order' | 'settings';

export function Dashboard() {
  // 从 URL 路径获取当前页面，默认为 'wallet'
  const getPageFromPath = (): Page => {
    const path = window.location.pathname;
    if (path === '/dashboard' || path === '/dashboard/wallet' || path === '/') {
      return 'wallet';
    } else if (path === '/dashboard/order') {
      return 'order';
    } else if (path === '/dashboard/settings') {
      return 'settings';
    }
    return 'wallet'; // 默认钱包页面
  };

  const [currentPage, setCurrentPage] = useState<Page>(getPageFromPath());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 监听 URL 变化
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await verifySession();
        if (result.success && result.username) {
          setIsAuthenticated(true);
          setUsername(result.username);
          // 如果当前路径不是 /dashboard 相关路径，跳转到 /dashboard
          const path = window.location.pathname;
          if (path !== '/dashboard' && path !== '/dashboard/wallet' && path !== '/dashboard/order' && path !== '/dashboard/settings') {
            window.history.replaceState(null, '', '/dashboard');
            setCurrentPage('wallet');
          }
        } else {
          setIsAuthenticated(false);
          // 如果未登录，跳转到根路径
          if (window.location.pathname.startsWith('/dashboard')) {
            window.history.replaceState(null, '', '/');
          }
        }
      } catch (error: any) {
        // 如果是连接错误，静默处理（可能是后端未启动）
        // 其他错误也静默处理，显示登录页面
        console.debug('Auth check failed:', error.message);
        setIsAuthenticated(false);
        // 如果未登录，跳转到根路径
        if (window.location.pathname.startsWith('/dashboard')) {
          window.history.replaceState(null, '', '/');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (loggedInUsername: string) => {
    setIsAuthenticated(true);
    setUsername(loggedInUsername);
    // 登录成功后跳转到 /dashboard
    window.history.pushState(null, '', '/dashboard');
    setCurrentPage('wallet');
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsAuthenticated(false);
      setUsername('');
      // 登出后跳转到根路径
      window.history.pushState(null, '', '/');
    } catch (error) {
      console.error('Logout failed:', error);
      // 即使登出失败，也清除本地状态
      setIsAuthenticated(false);
      setUsername('');
      // 登出后跳转到根路径
      window.history.pushState(null, '', '/');
    }
  };

  // 显示加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 显示登录页面
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="flex h-screen">
        {/* 左侧导航栏 */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-48'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300`}>
          <div className={`p-4 border-b border-slate-200 dark:border-slate-800 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
            {sidebarCollapsed ? (
              <User className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <User className="h-4 w-4" />
                <span className="truncate">{username}</span>
              </div>
            )}
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <Button
              variant={currentPage === 'wallet' ? 'default' : 'ghost'}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start'}`}
              onClick={() => {
                setCurrentPage('wallet');
                window.history.pushState(null, '', '/dashboard/wallet');
              }}
              title={sidebarCollapsed ? '钱包管理' : ''}
            >
              <Wallet className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-2'}`} />
              {!sidebarCollapsed && <span>钱包管理</span>}
            </Button>
            
            <Button
              variant={currentPage === 'order' ? 'default' : 'ghost'}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start'}`}
              onClick={() => {
                setCurrentPage('order');
                window.history.pushState(null, '', '/dashboard/order');
              }}
              title={sidebarCollapsed ? '订单支付' : ''}
            >
              <ShoppingCart className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-2'}`} />
              {!sidebarCollapsed && <span>订单支付</span>}
            </Button>
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <Button
              variant={currentPage === 'settings' ? 'default' : 'ghost'}
              className={`w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start'}`}
              onClick={() => {
                setCurrentPage('settings');
                window.history.pushState(null, '', '/dashboard/settings');
              }}
              title={sidebarCollapsed ? '设置' : ''}
            >
              <Settings className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-2'}`} />
              {!sidebarCollapsed && <span>设置</span>}
            </Button>
            <Button
              variant="ghost"
              className={`w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start'} text-slate-600 dark:text-slate-400`}
              onClick={handleLogout}
              title={sidebarCollapsed ? '退出登录' : ''}
            >
              <LogOut className={`h-4 w-4 ${sidebarCollapsed ? '' : 'mr-2'}`} />
              {!sidebarCollapsed && <span>退出登录</span>}
            </Button>
            
            {/* 折叠按钮 */}
            <Button
              variant="ghost"
              className={`w-full ${sidebarCollapsed ? 'justify-center px-0' : 'justify-center px-0'} text-slate-600 dark:text-slate-400 mt-2`}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? '展开' : '折叠'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {currentPage === 'wallet' && <WalletPage />}
            {currentPage === 'order' && (
              <div className="container mx-auto px-6 py-8 max-w-6xl">
                <OrderPage />
              </div>
            )}
            {currentPage === 'settings' && (
              <div className="container mx-auto px-6 py-8 max-w-6xl">
                <SettingsComponent />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
