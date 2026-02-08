/**
 * 密码设置/验证对话框组件
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordDialogProps {
  mode: 'set' | 'verify';
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
  title?: string;
  description?: string;
  error?: string; // 外部错误消息
}

export function PasswordDialog({ 
  mode, 
  onSubmit, 
  onCancel,
  title,
  description,
  error: externalError,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 当外部错误消息变化时，更新内部错误状态
  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'set') {
      if (!password) {
        setError('请输入密码');
        return;
      }
      if (password.length < 8) {
        setError('密码长度至少8位');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    } else {
      if (!password) {
        setError('请输入密码');
        return;
      }
    }

    if (typeof onSubmit !== 'function') {
      setError('提交函数未正确初始化');
      console.error('onSubmit is not a function:', onSubmit);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(password);
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>{title || (mode === 'set' ? '设置密码' : '输入密码')}</CardTitle>
          <CardDescription>
            {description || (mode === 'set' 
              ? '请设置一个密码来加密您的钱包数据。密码将用于加密私钥/助记词。' 
              : '请输入密码以解锁您的钱包。')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'set' ? '至少8位字符' : '请输入密码'}
                disabled={loading}
                autoFocus
              />
            </div>

            {mode === 'set' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  disabled={loading}
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? '处理中...' : '确认'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
