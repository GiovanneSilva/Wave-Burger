# =============================================================
# Wave Burger — carregar estoque para ~10 unidades de X-TERREMOTO
# =============================================================
#
# Quantidades calculadas a partir da ficha técnica real do X-TERREMOTO
# (consultada em 23/08/2026), multiplicando por 10 unidades:
#
#   Bacon dois         80g   x10 = 800g
#   Pão Grande          1un  x10 = 10un
#   Carne bovina três  250g  x10 = 2.500g (2,5kg)
#   Carne de Soja       80g  x10 = 800g
#   Tomate             100g  x10 = 1.000g (1kg)
#   Queijo mussarela    80g  x10 = 800g
#   Ovo                  2un x10 = 20un
#   Alface             0,1un x10 = 1un
#   Cebola              50g  x10 = 500g
#
# ("carne bovina" — a inativa, sem preço cadastrado — não faz parte da
# receita do X-TERREMOTO e foi deixada de fora de propósito.)
#
# Mesmo mecanismo do lancar-estoque-atual.ps1: ajuste manual de estoque
# com motivo "Inventário" (RF-017) — não cria compra nem conta a pagar.

$apiUrl = "http://localhost:3001"
$email = "admin@waveburger.dev"
$password = "WaveBurger#2026"

$estoqueAtual = @(
    @{ Nome = "bacon dois";          Quantidade = "800";  Unidade = "g" }
    @{ Nome = "Pão Grande";          Quantidade = "10";   Unidade = "un" }
    @{ Nome = "Carne bovina tres";   Quantidade = "2500"; Unidade = "g" }
    @{ Nome = "Carne de Soja";       Quantidade = "800";  Unidade = "g" }
    @{ Nome = "tomate";              Quantidade = "1000"; Unidade = "g" }
    @{ Nome = "queijo mussarela";    Quantidade = "800";  Unidade = "g" }
    @{ Nome = "ovo";                 Quantidade = "20";   Unidade = "un" }
    @{ Nome = "alface";              Quantidade = "1";    Unidade = "un" }
    @{ Nome = "Cebola";              Quantidade = "500";  Unidade = "g" }
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
        notes          = "Carga para ~10 unidades de X-TERREMOTO via script"
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
