param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location -LiteralPath $taskRoot

if (-not $env:GH_TOKEN) {
  throw 'Defina GH_TOKEN com permissão para publicar releases antes de continuar.'
}

$package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
if ($package.version -ne $Version) {
  throw "package.json está em $($package.version), mas a release solicitada é $Version. Atualize e confirme a versão antes de publicar."
}

$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível verificar o estado do Git.' }
if ($dirty) { throw 'O worktree não está limpo. Faça commit das alterações da release antes de publicar.' }

$tag = "v$Version"
git rev-parse -q --verify "refs/tags/$tag" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "A tag $tag não existe. Crie e envie a tag antes de publicar." }

npm.cmd run desktop:publish
if ($LASTEXITCODE -ne 0) { throw 'A publicação falhou.' }

Write-Host "Release $tag publicada. Confirme no GitHub a presença de Firekeep-Setup-$Version.exe e latest.yml."
