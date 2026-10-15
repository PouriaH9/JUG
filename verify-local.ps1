param([string]$BaseUrl = 'http://127.0.0.1:8080')
$ErrorActionPreference = 'Stop'
function Api($Method, $Path, $Body = $null, $Token = '') {
  $args = @{ Method=$Method; Uri="$BaseUrl/api$Path" }
  if ($Token) { $args.Headers = @{Authorization="Bearer $Token"} }
  if ($null -ne $Body) { $args.ContentType='application/json'; $args.Body=($Body | ConvertTo-Json -Depth 20) }
  Invoke-RestMethod @args
}
function Assert($Condition, $Message) { if (-not $Condition) { throw $Message } }
$health = Api GET '/health'
Assert ($health.storage -eq 'postgresql') 'This integration check requires PostgreSQL.'
$catalog = Api GET '/products'
$product = $catalog.products | Where-Object { $_.stock -ge 2 } | Select-Object -First 1
Assert ($null -ne $product) 'No available product.'
$address = @{name='JUG Integration Test';phone='09120000000';city='Test City';street='Local test address';postalCode='1234567890'}
$order = Api POST '/checkout' @{items=@(@{productId=$product.id;quantity=1;price=1});discountCode='FIRST10';address=$address}
Assert ($order.token.Length -gt 20) 'Guest token missing.'
$expected = $product.price - [Math]::Floor($product.price / 10)
$settings = Api GET '/settings'
$shipping = if ($settings.settings.freeShippingThreshold -gt 0 -and $expected -ge $settings.settings.freeShippingThreshold) {0} else {$settings.settings.shippingFee}
Assert ($order.order.total -eq ($expected+$shipping)) 'Order calculation mismatch.'
$paid = Api POST '/payments/test' @{orderId=$order.order.id} $order.token
Assert ($paid.order.paymentStatus -eq 'paid_test') 'Payment was not marked as simulated.'
$paidAgain = Api POST '/payments/test' @{orderId=$order.order.id} $order.token
$after = Api GET "/products/$($product.id)"
Assert ($after.product.stock -eq ($product.stock-1)) 'Payment is not idempotent.'
$history = Api GET '/orders' $null $order.token
Assert (@($history.orders | Where-Object {$_.id -eq $order.order.id}).Count -eq 1) 'Guest order history missing.'
$email = 'smoke-' + [Guid]::NewGuid().ToString('N') + '@jug.local'
$account = Api POST '/auth/register' @{name='Local smoke account';email=$email;password='JugSmoke!2026'}
Api PUT '/wishlist' @{productIds=@($product.id)} $account.token | Out-Null
$wish = Api GET '/wishlist' $null $account.token
Assert ($wish.productIds -contains $product.id) 'Wishlist did not persist.'
Api PUT '/cart' @{items=@(@{productId=$product.id;quantity=1})} $account.token | Out-Null
$cart = Api GET '/cart' $null $account.token
Assert ($cart.items.Count -eq 1) 'Account cart missing.'
$courses = Api GET '/courses'
$course = Api GET "/courses/$($courses.courses[0].id)"
Assert ($course.course.lessons[0].content.Length -gt 50) 'Written lesson missing.'
Api POST '/auth/logout' @{} $account.token | Out-Null
try { Api GET '/auth/me' $null $account.token | Out-Null; throw 'Logged-out token accepted.' } catch { if ($_.Exception.Message -eq 'Logged-out token accepted.') { throw } }
Write-Output "PASS: PostgreSQL, server totals, guest checkout, idempotent test payment, orders, wishlist, cart, written lessons and logout. Test order $($order.order.id)."
