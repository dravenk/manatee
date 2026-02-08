/**
 * 导出/导入数据组件
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Loader2 } from 'lucide-react';
import { exportData, importData, downloadJSON, readJSONFile } from '@/lib/api/export';

export function ExportImport() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError('');
    setSuccess('');

    try {
      const result = await exportData();
      
      if (!result.success) {
        throw new Error(result.error || '导出失败');
      }

      if (!result.fileName) {
        throw new Error('导出失败：未生成文件名');
      }

      setSuccess(`数据已导出到 private 目录：${result.fileName}`);
    } catch (err: any) {
      setError(err.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!fileInput?.files || fileInput.files.length === 0) {
      setError('请选择要导入的文件');
      return;
    }

    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const file = fileInput.files[0];
      const jsonData = await readJSONFile(file);

      // 验证数据结构
      if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('无效的数据文件');
      }

      const result = await importData(jsonData);

      if (!result.success) {
        throw new Error(result.error || '导入失败');
      }

      const counts = result.importedCounts;
      setSuccess(
        `导入成功！账户: ${counts?.accounts || 0}, 网络: ${counts?.networks || 0}, 地址: ${counts?.addresses || 0}`
      );

      // 清空文件输入
      if (fileInput) {
        fileInput.value = '';
      }

      // 刷新页面以显示新导入的数据
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>导出/导入数据</CardTitle>
        <CardDescription>
          导出或导入钱包数据、网络配置和设置。数据格式参考 MetaMask。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 导出部分 */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">导出数据</h3>
            <p className="text-sm text-muted-foreground mb-4">
              导出所有钱包账户、网络配置和设置到 JSON 文件。
            </p>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  导出数据
                </>
              )}
            </Button>
          </div>

          {/* 分隔线 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或</span>
            </div>
          </div>

          {/* 导入部分 */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">导入数据</h3>
              <p className="text-sm text-muted-foreground mb-4">
                从 JSON 文件导入钱包账户、网络配置和设置。
              </p>
              <div className="space-y-2">
                <Label htmlFor="import-file">选择文件</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".json"
                  ref={(el) => setFileInput(el)}
                  className="cursor-pointer"
                />
              </div>
              <Button
                onClick={handleImport}
                disabled={importing || !fileInput?.files || fileInput.files.length === 0}
                className="w-full mt-4"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    导入数据
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* 成功提示 */}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}
        </div>

        {/* 说明 */}
        <div className="p-4 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>注意：</strong>
            <br />
            • 导出的数据会保存到服务器的 private 目录
            <br />
            • 导出的数据包含所有钱包账户的地址和公钥
            <br />
            • 软件钱包的私钥需要密码才能导出（当前版本不导出私钥）
            <br />
            • 导入数据会合并到现有数据中，不会覆盖
            <br />
            • 数据格式完全参考 MetaMask 导出格式
            <br />
            • 硬件钱包连接后会自动保存
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
