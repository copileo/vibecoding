param(
    [int]$Port = 8000
)

$root = (Resolve-Path $PSScriptRoot).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Serving $root at http://localhost:$Port/"

$mimeTypes = @{
    '.css'         = 'text/css; charset=utf-8'
    '.html'        = 'text/html; charset=utf-8'
    '.js'          = 'text/javascript; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.md'          = 'text/markdown; charset=utf-8'
    '.svg'         = 'image/svg+xml'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
        $candidate = Join-Path $root $relativePath

        if (Test-Path -LiteralPath $candidate -PathType Container) {
            $candidate = Join-Path $candidate 'index.html'
        }

        try {
            $resolved = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
            if (-not $resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
                throw 'Path is outside the repository.'
            }

            $bytes = [IO.File]::ReadAllBytes($resolved)
            $extension = [IO.Path]::GetExtension($resolved).ToLowerInvariant()
            $context.Response.StatusCode = 200
            $context.Response.ContentType = $mimeTypes[$extension] ?? 'application/octet-stream'
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        catch {
            $message = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $context.Response.StatusCode = 404
            $context.Response.ContentType = 'text/plain; charset=utf-8'
            $context.Response.ContentLength64 = $message.Length
            $context.Response.OutputStream.Write($message, 0, $message.Length)
        }
        finally {
            $context.Response.OutputStream.Close()
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
