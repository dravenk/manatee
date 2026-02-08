# 硬件钱包集成文档

本项目实现了对 OneKey、Ledger 和 Trezor 三种硬件钱包的集成，用于数字货币支付系统。

## 功能特性

- ✅ 支持 OneKey 钱包（通过 TronWeb API）
- ✅ 支持 Ledger 硬件钱包（基础框架）
- ✅ 支持 Trezor 硬件钱包（基础框架）
- ✅ 统一的钱包管理接口
- ✅ React Hooks 支持
- ✅ TypeScript 类型安全
- ✅ 获取公钥作为支付地址

## 项目结构

```
frontend/
  src/
    types/
      wallet.ts              # 钱包类型定义
    lib/
      wallet/
        onekey.ts      # OneKey 钱包实现
        ledger.ts      # Ledger 钱包实现
        trezor.ts      # Trezor 钱包实现
        manager.ts     # 统一钱包管理器
    hooks/
      useWallet.ts     # React Hook
    components/
      WalletConnector.tsx  # 钱包连接组件
server/
  src/
    routes/
      wallet.ts        # 钱包相关API
    types/
      wallet.ts        # 服务端类型定义
```

## 使用方法

### 1. 前端使用

#### 使用 React Hook

```typescript
import { useWallet } from '@/hooks/useWallet';

function MyComponent() {
  const {
    connection,
    availableWallets,
    isConnecting,
    connect,
    disconnect,
    getPublicKey,
  } = useWallet();

  const handleConnect = async () => {
    try {
      await connect(WalletType.ONEKEY);
      const publicKey = await getPublicKey();
      console.log('支付地址（公钥）:', publicKey);
    } catch (error) {
      console.error('连接失败:', error);
    }
  };

  return (
    <div>
      {connection ? (
        <div>
          <p>已连接: {connection.address}</p>
          <button onClick={disconnect}>断开连接</button>
        </div>
      ) : (
        <button onClick={handleConnect}>连接钱包</button>
      )}
    </div>
  );
}
```

#### 使用 WalletConnector 组件

```typescript
import { WalletConnector } from '@/components/WalletConnector';

function App() {
  return (
    <div>
      <WalletConnector />
    </div>
  );
}
```

### 2. 后端 API

#### 验证钱包地址

```typescript
const response = await fetch('/api/wallet/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: 'TYourTronAddress...',
    publicKey: 'YourPublicKey...',
    walletType: 'onekey',
  }),
});

const result = await response.json();
console.log('验证结果:', result);
```

## 钱包类型

### OneKey

OneKey 钱包通过浏览器扩展提供 `window.$onekey.tron` 和 `window.tronWeb` API。

### Ledger

Ledger 硬件钱包需要：
1. 连接 USB 设备
2. 在设备上打开 TRON 应用
3. 使用 WebUSB API 进行通信

**注意**: Ledger 对 TRON 的完整支持可能需要使用 `@tronweb3/tronwallet-adapter-ledger` 包。

### Trezor

Trezor 硬件钱包需要：
1. 初始化 Trezor Connect
2. 使用 Trezor Connect API 获取地址和签名

**注意**: Trezor 对 TRON 的完整支持可能需要特定的配置和 API 调用。

## 开发说明

### 安装依赖

```bash
cd frontend
bun install
```

### 运行开发服务器

```bash
# 前端
cd frontend
bun run dev

# 后端
cd server
bun run dev
```

## 注意事项

1. **OneKey**: 需要安装 OneKey 浏览器扩展
2. **Ledger**: 
   - 需要物理连接 Ledger 设备
   - 需要在设备上打开 TRON 应用
   - 可能需要用户授权 USB 访问
3. **Trezor**:
   - 需要物理连接 Trezor 设备
   - 需要初始化 Trezor Connect
   - 某些功能可能需要特定的 Trezor 固件版本

## API 参考

### WalletManager

```typescript
class WalletManager {
  // 获取可用钱包列表
  async getAvailableWallets(): Promise<WalletType[]>
  
  // 连接钱包
  async connect(type: WalletType): Promise<WalletConnection>
  
  // 断开连接
  async disconnect(): Promise<void>
  
  // 获取当前连接
  getCurrentConnection(): WalletConnection | null
  
  // 获取地址
  async getAddress(): Promise<string>
  
  // 获取公钥
  async getPublicKey(): Promise<string>
  
  // 签名消息
  async signMessage(message: string): Promise<string>
  
  // 签名交易
  async signTransaction(transaction: any): Promise<any>
}
```

### useWallet Hook

```typescript
interface UseWalletReturn {
  connection: WalletConnection | null;
  availableWallets: WalletType[];
  isConnecting: boolean;
  error: WalletError | null;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  getAddress: () => Promise<string>;
  getPublicKey: () => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  signTransaction: (transaction: any) => Promise<any>;
  refreshAvailableWallets: () => Promise<void>;
}
```

## 后续改进

1. 完善 Ledger 和 Trezor 的 TRON 支持
2. 添加交易广播功能
3. 添加余额查询功能
4. 添加多链支持（不仅仅是 TRON）
5. 添加钱包连接状态持久化
6. 添加错误处理和重试机制

## 参考文档

- [OneKey TRON 集成文档](https://developer.onekey.so/en/connect-to-software/provider/tron/)
- [Ledger 设备交互文档](https://developers.ledger.com/docs/device-interaction/getting-started)
- [Trezor 开发者文档](https://trezor.io/other/partner-portal/for-developers/for-developers)
