# Variáveis de Templates Google Docs

## Templates de Contratos

### Produtos e seus Templates

| Produto | Template ID | Variáveis Disponíveis |
|---------|-------------|----------------------|
| **Titan 12M** | `1zYuJKQaoBgDPMQWEGcovwxozNNjDTJX1dodlPM0GOL0` | Todas abaixo |
| **Titan 6M** | `1aYoPzKMP7Ghnvz6gP_ZKeCxb86T8me7M9X6L_1bfIlA` | Todas abaixo |
| **Titan Black** | `1aYoPzKMP7Ghnvz6gP_ZKeCxb86T8me7M9X6L_1bfIlA` | Todas abaixo |
| **Acelerador** | `1aYoPzKMP7Ghnvz6gP_ZKeCxb86T8me7M9X6L_1bfIlA` | Todas abaixo |
| **Lendário** | `11nBGI55qnEdRop7lODMfHHKdur1U6mrEpCKy_ua9uk0` | Todas abaixo |

## Variáveis por Categoria

### Dados Pessoais
| Placeholder | Campo do Formulário | Exemplo |
|-------------|---------------------|---------|
| `{{nome}}` | nome | João Silva |
| `{{nacionalidade}}` | nacionalidade | Brasileira |
| `{{profissão}}` | profissao | Empresário |
| `{{estadocivil}}` | estadoCivil | Casado(a) |
| `{{cpncnpj}}` | cpfCnpj | 123.456.789-00 |
| `{{rg}}` | rg | 12.345.678-9 |
| `{{telefone}}` | telefone | (11) 98765-4321 |
| `{{email}}` | email | joao@email.com |

### Endereço
| Placeholder | Campo do Formulário | Exemplo |
|-------------|---------------------|---------|
| `{{Rua}}` | rua | Av. Paulista |
| `{{Numero}}` | numero | 1000 |
| `{{Complemento}}` | complemento | Apto 123 |
| `{{Bairro}}` | bairro | Centro |
| `{{CEP}}` | cep | 01310-100 |

### Dados do Contrato
| Placeholder | Campo do Formulário | Exemplo |
|-------------|---------------------|---------|
| `{{produto}}` | qualProdutoOClienteComprou | Titan 12M |
| `{{ValorContrato}}` | qualValorDoCurso | R$ 5.000,00 |
| `{{valormentoria90%}}` | calculado | 4500.00 |
| `{{valormentoria10%}}` | calculado | 500.00 |
| `{{duracao}}` | calculado | 12 meses |
| `{{formadepagamento}}` | formaDePagamento | Boleto/PIX |
| `{{Parcela}}` | quantasParcelasEValor | 12x de R$ 500,00 |
| `{{Entrada}}` | qualFoiValorDaEntrada | R$ 500,00 |
| `{{Dia}}` | qualDiaParcelas | 10 |
| `{{dataincio}}` | dataInicioContrato | 2026-03-07 |
| `{{dataatual}}` | calculado | 07/03/2026 |
| `{{hoje}}` | calculado | 7 de março de 2026 |

## Templates de Aditivos

| Template | Template ID |
|----------|-------------|
| Aditivos | `1kM5DWjqsbSYvpmEuRB05oy1SUAAT39zQXT4hhqomrRk` |

### Variáveis Adicionais (apenas Aditivos)

| Placeholder | Descrição |
|-------------|-----------|
| `{{clausulacompromisso}}` | Texto da cláusula de compromisso |

**Nota:** A variável `{{clausulacompromisso}}` **NÃO existe** nos templates de contratos, apenas em aditivos!

## Pasta de Documentos Gerados

**Folder ID:** `12srnA2T3RKE6Utf7aqu3CrP7BkK2KaSPZU3komgF543owsV8AzFuWGMmF3aqOOMWzmtDQYsq`
