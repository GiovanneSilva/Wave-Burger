# =============================================================
# Wave Burger — lançar estoque físico real (inventário inicial)
# =============================================================
#
# Como usar:
#   1. Edite a lista $estoqueAtual abaixo com os ingredientes e
#      quantidades que você TEM DE VERDADE hoje.
#   2. Rode este script: .\lancar-estoque-atual.ps1
#
# O que ele faz:
#   - Faz login
#   - Para cada linha, procura o ingrediente pelo NOME (precisa bater
#     exatamente com o nome cadastrado em Ingredientes)
#   - Lança uma ENTRADA de estoque com motivo "Inventário" — não cria
#     compra nem conta a pagar, só ajusta o saldo (RF-017)
#
# Pode rodar de novo sempre que quiser fazer uma nova contagem física
# — cada linha vira uma ENTRADA adicional (some com o saldo atual, não
# substitui). Se quiser CORRIGIR o saldo para um valor exato (em vez de
# somar), use motivo "Correção" fazendo a conta você mesmo (diferença
# entre o que o sistema mostra e o que você contou).

$apiUrl = "http://localhost:3001"
$email = "admin@waveburger.dev"
$password = "WaveBurger#2026"

# -------------------------------------------------------------
# EDITE AQUI: nome do ingrediente (igual está cadastrado) + quantidade
# + unidade (kg, g, l, ml, un — precisa ser uma unidade da mesma
# família da unidade padrão do ingrediente; ex.: se o ingrediente usa
# "kg" como padrão, você pode lançar em "kg" ou "g", mas não em "un").
# -------------------------------------------------------------
$estoqueAtual = @(
    @{ Nome = "Carne Bovina";  Quantidade = "5";   Unidade = "kg" }
    @{ Nome = "Pão Brioche";   Quantidade = "40";  Unidade = "un" }
    # @{ Nome = "Queijo";      Quantidade = "2";   Unidade = "kg" }
    # adicione quantas linhas precisar, copiando o padrão acima
)

# -------------------------------------------------------------
# Não precisa editar daqui pra baixo
# -------------------------------------------------------------

Write-Host "Fazendo login..." -ForegroundColor Cyan
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "$apiUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $response.accessToken
$businessUnitId = $response.user.businessUnitId
$headers = @{ Authorization = "Bearer $token" }

Write-Host "Buscando catálogo de ingredientes..." -ForegroundColor Cyan
$ingredientes = Invoke-RestMethod -Uri "$apiUrl/ingredients" -Headers $headers

$sucesso = 0
$falhas = 0

foreach ($item in $estoqueAtual) {
    $ingrediente = $ingredientes | Where-Object { $_.name -eq $item.Nome } | Select-Object -First 1

    if (-not $ingrediente) {
        Write-Host "  [FALHA] Ingrediente '$($item.Nome)' não encontrado no catálogo — confira o nome exato em /ingredients." -ForegroundColor Red
        $falhas++
        continue
    }

    $body = @{
        businessUnitId = $businessUnitId
        ingredientId   = $ingrediente.id
        direction      = "IN"
        quantity       = $item.Quantidade
        unit           = $item.Unidade
        reason         = "INVENTORY"
        notes          = "Carga inicial de estoque via script"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$apiUrl/stock/adjustments" -Method Post -Headers $headers -Body $body -ContentType "application/json" | Out-Null
        Write-Host "  [OK] $($item.Nome): +$($item.Quantidade) $($item.Unidade)" -ForegroundColor Green
        $sucesso++
    } catch {
        $erro = $_.ErrorDetails.Message
        Write-Host "  [FALHA] $($item.Nome): $erro" -ForegroundColor Red
        $falhas++
    }
}

Write-Host ""
Write-Host "Concluído: $sucesso lançados, $falhas falharam." -ForegroundColor Cyan
