import json
from sentence_transformers import SentenceTransformer, util

# Modelo leve e rápido, multilingue
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
model = SentenceTransformer(MODEL_NAME)

def embed_texts(texts):
    return model.encode(texts, convert_to_tensor=True)

def match_quote_to_works(quote, works, top_k=5):
    # Gera embeddings
    quote_emb = embed_texts([quote if isinstance(quote, str) else quote['text']])
    # Se works é lista de dicts, extrai textos
    works_texts = [w if isinstance(w, str) else w['text'] for w in works]
    works_emb = embed_texts(works_texts)
    # Similaridade cosseno
    scores = util.cos_sim(quote_emb, works_emb)[0].cpu().numpy()
    # Ordena por score e retorna objeto completo
    ranked = sorted(zip(works, scores), key=lambda x: x[1], reverse=True)
    return [
        {
            'text': w['text'] if isinstance(w, dict) else w,
            'author': w.get('author') if isinstance(w, dict) else None,
            'theme': w.get('theme') if isinstance(w, dict) else None,
            'score': float(score)
        }
        for w, score in ranked[:top_k]
    ]

import sys

if __name__ == '__main__':
    # Se argumentos: [input_json, output_json], lê dados dinâmicos
    if len(sys.argv) == 3:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.load(f)
        quote = data['quote']
        works = data['works']
        top_k = data.get('top_k', 5)
        top_matches = match_quote_to_works(quote, works, top_k=top_k)
        # Exporta para JSON
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            json.dump(top_matches, f, ensure_ascii=False, indent=2)
    else:
        # Exemplo: obra de Interestelar e várias quotes
        obra = "Em um futuro distópico, a Terra está morrendo e um grupo de astronautas viaja por um buraco de minhoca em busca de um novo lar para a humanidade, enfrentando dilemas sobre tempo, amor, sacrifício e o destino humano."
        quotes = [
            {"text": "O homem está condenado a ser livre.", "author": "Jean-Paul Sartre", "theme": "liberdade"},
            {"text": "O essencial é invisível aos olhos.", "author": "Antoine de Saint-Exupéry", "theme": "essência"},
            {"text": "A vida deve ser compreendida para trás. Mas deve ser vivida para frente.", "author": "Søren Kierkegaard", "theme": "vida"},
            {"text": "O que sabemos é uma gota; o que ignoramos é um oceano.", "author": "Isaac Newton", "theme": "conhecimento"},
            {"text": "Penso, logo existo.", "author": "René Descartes", "theme": "existência"},
            {"text": "A esperança é o sonho do homem acordado.", "author": "Aristóteles", "theme": "esperança"},
            {"text": "O universo não é apenas mais estranho do que imaginamos, é mais estranho do que podemos imaginar.", "author": "J.B.S. Haldane", "theme": "cosmos"}
        ]
        # O match é: dado o tema da obra, quais quotes mais combinam
        top_matches = match_quote_to_works(obra, quotes, top_k=5)
        # Exporta para JSON
        with open('embeddings_results.json', 'w', encoding='utf-8') as f:
            json.dump(top_matches, f, ensure_ascii=False, indent=2)
        print("Top quotes para Interestelar:")
        for q in top_matches:
            print(f"Quote: {q['text']}\nAutor: {q['author']}\nTema: {q['theme']}\nScore: {q['score']:.4f}\n")
