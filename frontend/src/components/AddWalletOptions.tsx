/**
 * 添加钱包选项页面
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { X, Wallet, Key, Lock, FileText } from 'lucide-react';
import { WalletConnector } from './WalletConnector';
import { ImportWallet } from './ImportWallet';
import { MetaMaskImport } from './MetaMaskImport';
import { WalletType } from '../../types/wallet';

export type AddWalletMode = 
  | 'select' // 选择模式
  | 'hardware' // 连接硬件钱包
  | 'seed' // 助记词钱包
  | 'privateKey' // 私钥钱包
  | 'existing'; // 添加已有钱包（从备份恢复）

interface AddWalletOptionsProps {
  onClose: () => void;
  onSuccess?: () => void;
  onImport?: (type: WalletType, credentials: { mnemonic?: string; privateKey?: string }, password: string) => Promise<void>;
  onMetaMaskImport?: (mnemonic: string, password: string) => Promise<void>;
}

export function AddWalletOptions({ onClose, onSuccess, onImport, onMetaMaskImport }: AddWalletOptionsProps) {
  const [mode, setMode] = useState<AddWalletMode>('select');
  const [showImport, setShowImport] = useState(false);
  const [showMetaMaskImport, setShowMetaMaskImport] = useState(false);

  const handleModeSelect = (selectedMode: AddWalletMode) => {
    if (selectedMode === 'hardware') {
      setMode('hardware');
    } else if (selectedMode === 'seed') {
      setMode('seed');
      setShowImport(true);
    } else if (selectedMode === 'privateKey') {
      setMode('privateKey');
      setShowImport(true);
    } else if (selectedMode === 'existing') {
      setMode('existing');
      setShowMetaMaskImport(true);
    }
  };

  const handleBack = () => {
    setMode('select');
    setShowImport(false);
    setShowMetaMaskImport(false);
  };

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  // 如果选择了具体模式，显示相应的组件
  if (mode === 'hardware') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>连接硬件钱包</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <WalletConnector />
            <div className="mt-4">
              <Button variant="outline" onClick={handleBack} className="w-full">
                返回
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'seed' && showImport) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>导入助记词钱包</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ImportWallet
              onImport={async (type, credentials, password) => {
                if (onImport) {
                  await onImport(type, credentials, password);
                }
                handleSuccess();
              }}
              onCancel={handleBack}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'privateKey' && showImport) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>导入私钥钱包</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ImportWallet
              onImport={async (type, credentials, password) => {
                if (onImport) {
                  await onImport(type, credentials, password);
                }
                handleSuccess();
              }}
              onCancel={handleBack}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'existing' && showMetaMaskImport) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>从备份恢复钱包</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <MetaMaskImport
              onImport={async (mnemonic, password) => {
                if (onMetaMaskImport) {
                  await onMetaMaskImport(mnemonic, password);
                }
                handleSuccess();
              }}
              onCancel={handleBack}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 默认显示选择页面
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>添加钱包</CardTitle>
            <CardDescription>选择添加钱包的方式</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 连接硬件钱包 */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-start justify-start"
            onClick={() => handleModeSelect('hardware')}
          >
            <Wallet className="h-5 w-5 mr-3 mt-0.5 text-primary" />
            <div className="text-left">
              <div className="font-semibold">连接硬件钱包</div>
              <div className="text-sm text-muted-foreground">
                连接 OneKey、Ledger 或 Trezor 硬件钱包
              </div>
            </div>
          </Button>

          {/* 助记词钱包 */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-start justify-start"
            onClick={() => handleModeSelect('seed')}
          >
            <Key className="h-5 w-5 mr-3 mt-0.5 text-primary" />
            <div className="text-left">
              <div className="font-semibold">助记词钱包</div>
              <div className="text-sm text-muted-foreground">
                使用 12 或 24 个单词的助记词创建钱包
              </div>
            </div>
          </Button>

          {/* 私钥钱包 */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-start justify-start"
            onClick={() => handleModeSelect('privateKey')}
          >
            <Lock className="h-5 w-5 mr-3 mt-0.5 text-primary" />
            <div className="text-left">
              <div className="font-semibold">私钥钱包</div>
              <div className="text-sm text-muted-foreground">
                直接导入私钥创建钱包
              </div>
            </div>
          </Button>

          {/* 从备份恢复 */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-start justify-start"
            onClick={() => handleModeSelect('existing')}
          >
            <FileText className="h-5 w-5 mr-3 mt-0.5 text-primary" />
            <div className="text-left">
              <div className="font-semibold">从备份恢复</div>
              <div className="text-sm text-muted-foreground">
                从 MetaMask 或其他钱包备份文件恢复
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
