Set-StrictMode -Version Latest

npx webpack --watch --mode=production &
npx browser-sync start --server '.' --files '.' &

# 全てのジョブの出力を受信する
$lastWriteJobId = $null
while (Get-Job | Where-Object { -! ($_.State -eq "Completed" -or $_.State -eq "Failed") -or $_.HasMoreData } | Select-Object -First 1) {
    foreach ($job in Get-Job -HasMoreData $true) {
        $output = $job | Receive-Job
        if (-! $output) { continue }

        # 違うジョブなら区切りを追加
        if ($lastWriteJobId -ne $job.Id) {
            $headerLength = 34
            $maxCommandLength = 27

            # フッター
            if ($null -ne $lastWriteJobId) {
                Write-Output "┗━━━$("━" * $headerLength)"
            }

            # ヘッダー
            $command = $job.Command

            # 自動的に追加されるコマンドを削除
            $command = $command -replace '^Microsoft\.PowerShell\.Management\\Set-Location\b.*?;\s*(.*)$', '$1'

            # 長すぎるコマンドの最後を切り捨て
            $truncatedCommand = $command.Substring(0, [Math]::Min($maxCommandLength, $command.Length))
            if ($maxCommandLength -lt $command.Length) { $truncatedCommand += "…" }

            $header = "> $truncatedCommand"
            Write-Output "┏━ $header $("━" * [Math]::Max($headerLength - $header.Length, 0))"
        }

        # 新しい出力行を書き出す
        foreach ($line in $output) {
            Write-Output "┃ $line"
            $lastWriteJobId = $job.Id
        }
    }
    Start-Sleep -Seconds 1
}
