/**
 * MetaMask 导入组件
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PasswordDialog } from './PasswordDialog';
import { MetaMaskWallet } from '@/lib/wallet/metamask';
import type { MetaMaskAccount, MetaMaskExportData } from '@/lib/wallet/metamask';
import { decryptMetaMaskExport } from '@/lib/crypto/metamaskVault';
import { WalletType } from '@/types/wallet';

interface MetaMaskImportProps {
  onImport: (mnemonic: string, password: string) => Promise<void>;
  onCancel: () => void;
}

export function MetaMaskImport({ onImport, onCancel }: MetaMaskImportProps) {
  const [fileContent, setFileContent] = useState<MetaMaskExportData | null>(null);
  const [accounts, setAccounts] = useState<MetaMaskAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<MetaMaskAccount | null>(null);
  const [hasVault, setHasVault] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string) as MetaMaskExportData;
        setFileContent(content);
        const parsed = MetaMaskWallet.parseExportFile(content);
        setAccounts(parsed);
        
        // 检查是否有加密的 vault
        const { extractVaultFromMetaMask } = await import('@/lib/crypto/metamaskVault');
        const vault = extractVaultFromMetaMask(content);
        setHasVault(!!vault);
        
        setError('');
      } catch (err: any) {
        setError('无效的 MetaMask 导出文件: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleAccountSelect = (account: MetaMaskAccount) => {
    setSelectedAccount(account);
    setError('');
  };

  const handleImport = () => {
    if (!fileContent) {
      setError('请先上传 MetaMask 导出文件');
      return;
    }
    
    if (!hasVault) {
      setError('导出文件中未找到加密的 vault 数据。请确保导出文件包含加密的私钥/助记词。');
      return;
    }
    
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async (metamaskPassword: string) => {
    if (!fileContent) {
      setError('请先上传 MetaMask 导出文件');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 使用 MetaMask 密码解密 vault
      const credentials = decryptMetaMaskExport(fileContent, metamaskPassword);
      
      if (!credentials.mnemonic && (!credentials.privateKeys || credentials.privateKeys.length === 0)) {
        throw new Error('无法从 vault 中提取助记词或私钥');
      }
      
      // 如果有助记词，使用助记词导入
      if (credentials.mnemonic) {
        // 设置一个新的应用密码用于加密存储
        // 这里我们使用 MetaMask 密码作为应用密码（或者可以提示用户设置新密码）
        await onImport(credentials.mnemonic, metamaskPassword);
      } else if (credentials.privateKeys && credentials.privateKeys.length > 0) {
        // 如果有私钥，使用第一个私钥导入
        // 注意：这里需要修改 onImport 以支持私钥导入
        throw new Error('私钥导入功能需要单独实现');
      }
      
      setShowPasswordDialog(false);
    } catch (err: any) {
      setError(err.message || '解密失败，请检查密码是否正确');
      setShowPasswordDialog(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>导入 MetaMask 钱包</CardTitle>
          <CardDescription>
            上传 MetaMask 导出文件，输入 MetaMask 密码即可解密并导入。解密后的私钥将保存在内存中使用。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metamask-file">上传 MetaMask 导出文件</Label>
            <Input
              id="metamask-file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              选择包含加密 vault 的 MetaMask 导出 JSON 文件
            </p>
          </div>

          {hasVault && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ 检测到加密的 vault 数据
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                请输入您的 MetaMask 密码以解密私钥和助记词
              </p>
            </div>
          )}

          {fileContent && !hasVault && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ 未检测到加密的 vault 数据
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                此文件可能不包含加密的私钥/助记词。请确保导出的是包含加密数据的完整备份文件。
              </p>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>检测到的账户 ({accounts.length} 个)</Label>
              <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-2 border rounded cursor-pointer hover:bg-muted ${
                      selectedAccount?.id === account.id ? 'bg-muted border-primary' : ''
                    }`}
                    onClick={() => handleAccountSelect(account)}
                  >
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {account.address}
                    </div>
                    {account.derivationPath && (
                      <div className="text-xs text-muted-foreground">
                        路径: {account.derivationPath}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
              onClick={handleImport}
              disabled={!fileContent || !hasVault || loading}
              className="flex-1"
            >
              {loading ? '解密中...' : '解密并导入'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showPasswordDialog && (
        <PasswordDialog
          mode="verify"
          onSubmit={handlePasswordSubmit}
          onCancel={() => setShowPasswordDialog(false)}
          title="输入 MetaMask 密码"
          description="请输入您的 MetaMask 主密码以解密导出文件中的私钥和助记词。解密后的数据将保存在内存中使用。"
        />
      )}
    </>
  );
}
