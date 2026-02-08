/**
 * 登录页面
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { login, register } from '../lib/api/auth';

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(username, password);
        if (result.success && result.username) {
          onLoginSuccess(result.username);
        } else {
          setError(result.error || '登录失败');
        }
      } else {
        const result = await register(username, password);
        if (result.success) {
          // 注册成功后自动登录
          const loginResult = await login(username, password);
          if (loginResult.success && loginResult.username) {
            onLoginSuccess(loginResult.username);
          } else {
            setError('注册成功，但自动登录失败，请手动登录');
          }
        } else {
          setError(result.error || '注册失败');
        }
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isLogin ? '登录' : '注册'}
          </CardTitle>
          <CardDescription>
            {isLogin ? '登录您的账户以继续' : '创建新账户'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                required
                minLength={6}
              />
              {!isLogin && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  密码至少需要 6 个字符
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !username || !password}
            >
              {loading ? '处理中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
