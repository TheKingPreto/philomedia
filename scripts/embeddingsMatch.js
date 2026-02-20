// Executa o script Python de embeddings e retorna os matches
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * Executa o script Python, passando quote e obras, e retorna os matches.
 * @param {string} quote
 * @param {string[]} works
 * @param {number} topK
 * @returns {Promise<Array<{work: string, score: number}>>}
 */
export async function matchQuoteToWorks(quote, works, topK = 5) {
  // Cria arquivos temporários de entrada/saída
  const inputPath = path.resolve('scripts', 'embeddings_input.json');
  const outputPath = path.resolve('scripts', 'embeddings_results.json');
  await fs.writeFile(inputPath, JSON.stringify({ quote, works, top_k: topK }, null, 2), 'utf-8');

  // Executa o script Python
  await new Promise((resolve, reject) => {
    const py = spawn('python', ['scripts/embeddings_match.py', inputPath, outputPath]);
    py.on('error', reject);
    py.stderr.on('data', data => process.stderr.write(data));
    py.on('close', code => code === 0 ? resolve() : reject(new Error('Python script failed')));
  });

  // Lê o resultado
  const data = await fs.readFile(outputPath, 'utf-8');
  // Remove o campo score antes de retornar
  const results = JSON.parse(data);
  return results.map(({ text, author, theme }) => ({ text, author, theme }));
}

// Exemplo de uso (remova em produção)
if (process.argv[2] === '--demo') {
  (async () => {
    const quote = 'A vida é feita de escolhas.';
    const works = [
      'O ser humano é livre para escolher seu destino.',
      'A existência precede a essência.',
      'O amor é a força mais poderosa.',
      'Escolher é abdicar.',
      'A vida é um conjunto de decisões.'
    ];
    const matches = await matchQuoteToWorks(quote, works, 3);
    console.log('Top matches:', matches);
  })();
}
