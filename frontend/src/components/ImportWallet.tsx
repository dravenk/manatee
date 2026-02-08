/**
 * 导入钱包组件（助记词或私钥）
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PasswordDialog } from './PasswordDialog';
import { WalletType } from '@/types/wallet';

interface ImportWalletProps {
  onImport: (type: WalletType, credentials: { mnemonic?: string; privateKey?: string }, password: string) => Promise<void>;
  onCancel: () => void;
}

export function ImportWallet({ onImport, onCancel }: ImportWalletProps) {
  const [importType, setImportType] = useState<'mnemonic' | 'privateKey'>('mnemonic');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (importType === 'mnemonic') {
      if (!mnemonic.trim()) {
        setError('请输入助记词');
        return;
      }
      const words = mnemonic.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        setError('助记词必须是12个或24个单词');
        return;
      }
    } else {
      if (!privateKey.trim()) {
        setError('请输入私钥');
        return;
      }
      const trimmedKey = privateKey.trim();
      if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
        setError('私钥格式错误，必须是64位十六进制字符串');
        return;
      }
    }

    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async (password: string) => {
    setLoading(true);
    try {
      if (importType === 'mnemonic') {
        await onImport(WalletType.MNEMONIC, { mnemonic: mnemonic.trim() }, password);
      } else {
        await onImport(WalletType.PRIVATE_KEY, { privateKey: privateKey.trim() }, password);
      }
    } catch (err: any) {
      setError(err.message || '导入失败');
      setShowPasswordDialog(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>导入钱包</CardTitle>
          <CardDescription>
            通过助记词或私钥导入您的钱包
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>导入方式</Label>
              <Select
                value={importType}
                onValueChange={(value) => {
                  setImportType(value as 'mnemonic' | 'privateKey');
                  setError('');
                }}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mnemonic">助记词 (BIP39)</SelectItem>
                  <SelectItem value="privateKey">私钥</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {importType === 'mnemonic' ? (
              <div className="space-y-2">
                <Label htmlFor="mnemonic">助记词</Label>
                <Textarea
                  id="mnemonic"
                  value={mnemonic}
                  onChange={(e) => {
                    setMnemonic(e.target.value);
                    setError('');
                  }}
                  placeholder="请输入12个或24个单词的助记词，用空格分隔"
                  rows={4}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  请确保在安全的环境中输入助记词，不要与他人分享
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="privateKey">私钥</Label>
                <Textarea
                  id="privateKey"
                  value={privateKey}
                  onChange={(e) => {
                    setPrivateKey(e.target.value);
                    setError('');
                  }}
                  placeholder="请输入64位十六进制私钥"
                  rows={4}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  请确保在安全的环境中输入私钥，不要与他人分享
                </p>
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
                {loading ? '导入中...' : '导入钱包'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {showPasswordDialog && (
        <PasswordDialog
          mode="set"
          onSubmit={handlePasswordSubmit}
          onCancel={() => setShowPasswordDialog(false)}
          title="设置加密密码"
          description="请设置一个密码来加密您的钱包数据。密码将用于加密私钥/助记词并保存到本地。"
        />
      )}
    </>
  );
}
