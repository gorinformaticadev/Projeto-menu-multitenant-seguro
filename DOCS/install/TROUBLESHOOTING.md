# Troubleshooting

## 1) Dominio nao aponta para a VPS
Sintoma: o script aborta no check de DNS/IP.
Acao:
- Veja o IP publico da VPS com `curl -4 ifconfig.me`.
- Compare com `dig +short A seu-dominio.com`.
- Ajuste o registro A e aguarde propagacao.

## 2) Porta 80/443 ocupada
Sintoma: erro de conflito de porta.
Acao:
- Rode `ss -tulnp | egrep ':(80|443)\s'` para identificar o processo.
- Se for host nginx/apache, pare e desabilite o servico.
- Se for container Docker que nao e o proxy esperado, remova o conflito antes de executar novamente.

## 3) Proxy parcial encontrado
Sintoma: existe `nginx-proxy` sem `acme-companion` (ou vice-versa).
Acao:
- Corrija manualmente o stack atual (suba os dois juntos) ou remova o stack incompleto.
- Execute o instalador novamente.

## 4) Certificado nao emite
Sintoma: HTTP responde, HTTPS nao sobe.
Acao:
- Verifique logs:
  - `docker logs nginx-proxy --tail 200`
  - `docker logs acme-companion --tail 200`
- Confirme que `VIRTUAL_HOST`, `LETSENCRYPT_HOST` e `LETSENCRYPT_EMAIL` estao no container da app.
- Confira se as portas 80/443 estao abertas no firewall/cloud.

## 5) Rate limit da Let's Encrypt
Sintoma: mensagem de limite excedido nos logs do companion.
Acao:
- Aguarde janela de renovacao da Let\'s Encrypt.
- Evite recriar dominio/cert repetidamente em curto periodo.
- Para testes frequentes, use homologacao/staging antes de producao.

## 6) Erro "host not found in upstream"
Sintoma: roteamento quebrado entre proxy e app.
Acao:
- Garanta que app e proxy estejam na mesma network Docker.
- Nao use IP fixo de container; use nome DNS do container na network compartilhada.
- Reexecute o instalador para reconectar automaticamente a app na network do proxy.
