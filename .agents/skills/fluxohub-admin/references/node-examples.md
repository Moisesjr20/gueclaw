# Exemplos de Código de Nós

## 1. Nó: Processar Dados do Cliente (Node 2)

```javascript
const input = triggerOutput?.output || {};
const valorCurso = parseFloat(input.qualValorDoCurso?.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
const valor90 = (valorCurso * 0.9).toFixed(2);
const valor10 = (valorCurso * 0.1).toFixed(2);

let templateId = '';
switch (input.qualProdutoOClienteComprou) {
  case 'Titan 12M':
    templateId = '1zYuJKQaoBgDPMQWEGcovwxozNNjDTJX1dodlPM0GOL0';
    break;
  case 'Lendário':
    templateId = '11nBGI55qnEdRop7lODMfHHKdur1U6mrEpCKy_ua9uk0';
    break;
  default:
    templateId = '1aYoPzKMP7Ghnvz6gP_ZKeCxb86T8me7M9X6L_1bfIlA';
}

const duracao = input.qualProdutoOClienteComprou?.includes('12') ? '12 meses' : '6 meses';
const dataInicio = input.dataInicioContrato || new Date().toISOString().split('T')[0];

return {
  output: {
    ...input,
    valorCurso,
    valor90,
    valor10,
    templateId,
    duracao,
    dataInicio
  }
};
```

## 2. Nó: Preparar Variáveis do Documento (Node 4)

```javascript
const input = triggerOutput?.output || {};
const valorCurso = parseFloat(input.qualValorDoCurso?.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
const valor90 = (valorCurso * 0.9).toFixed(2);
const valor10 = (valorCurso * 0.1).toFixed(2);
const dataInicio = input.dataInicioContrato || new Date().toISOString().split('T')[0];
const dataAtual = new Date().toLocaleDateString('pt-BR');
const dataPorExtenso = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const duracao = input.qualProdutoOClienteComprou?.includes('12') ? '12 meses' : '6 meses';

const placeholders = {
  "{{nome}}": input.nome || "",
  "{{nacionalidade}}": input.nacionalidade || "",
  "{{profissão}}": input.profissao || "",
  "{{estadocivil}}": input.estadoCivil || "",
  "{{cpncnpj}}": input.cpfCnpj || "",
  "{{rg}}": input.rg || "",
  "{{Rua}}": input.rua || "",
  "{{Numero}}": input.numero || "",
  "{{Complemento}}": input.complemento || "",
  "{{Bairro}}": input.bairro || "",
  "{{CEP}}": input.cep || "",
  "{{telefone}}": input.telefone || "",
  "{{email}}": input.email || "",
  "{{dataincio}}": dataInicio,
  "{{dataatual}}": dataAtual,
  "{{produto}}": input.qualProdutoOClienteComprou || "",
  "{{duracao}}": duracao,
  "{{ValorContrato}}": input.qualValorDoCurso || "",
  "{{valormentoria90%}}": valor90,
  "{{valormentoria10%}}": valor10,
  "{{formadepagamento}}": input.formaDePagamento || "",
  "{{Parcela}}": input.quantasParcelasEValor || "",
  "{{Entrada}}": input.qualFoiValorDaEntrada || "",
  "{{Dia}}": input.qualDiaParcelas || "10",
  "{{hoje}}": dataPorExtenso
};

return {
  output: {
    placeholders,
    templateId: input.templateId,
    product: input.qualProdutoOClienteComprou,
    valorCurso,
    valor90,
    valor10,
    dataInicio,
    dataAtual,
    dataPorExtenso,
    duracao
  }
};
```

## 3. Nó: Roteador de Produtos (Node 3)

```javascript
const input = triggerOutput?.output || {};
const product = input.qualProdutoOClienteComprou;

let route = 'default';
if (product === 'Titan 12M') route = 'titan12m';
else if (product === 'Lendário') route = 'lendario';

return {
  output: { ...input, route }
};
```

## 4. Nó: Output Final (Node 5)

```javascript
const input = triggerOutput?.output || {};
return {
  output: input
};
```
