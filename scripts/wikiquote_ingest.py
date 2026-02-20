
import requests
import re
import json
import sys
from bs4 import BeautifulSoup

def get_citation_sections(soup):
    # Busca seções com títulos "Citações", "Frases", "Citações de ...", etc
    sections = []
    for h in soup.find_all(['h2', 'h3']):
        title = h.get_text().strip().lower()
        if any(word in title for word in ['cita', 'frase']):
            # Pega todos os irmãos até o próximo h2/h3
            sibs = []
            for sib in h.find_next_siblings():
                if sib.name in ['h2', 'h3']:
                    break
                sibs.append(sib)
            sections.append(sibs)
    return sections

# Exemplo: coletar frases de um autor na Wikiquote PT
# Exemplo de URL: https://pt.wikiquote.org/wiki/Jean-Paul_Sartre


import re

def normalize_quote_text(text):
    # Remove aspas duplicadas no início/fim
    text = text.strip()
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1].strip()

    # Remove aspas duplicadas no início/fim e espaços extras
    text = text.strip()
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1].strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def fetch_quotes_from_html(soup, author_name, theme=None, lang='pt', source=None):
    quotes = []
    mw_content = soup.find('div', class_='mw-parser-output')
    if not mw_content:
        return quotes
    elements = list(mw_content.children)
    i = 0
    while i < len(elements):
        el = elements[i]
        # Only <ul> directly under mw-parser-output
        if el.name == 'ul':
            for li in el.find_all('li', recursive=False):
                quote_text = li.get_text(strip=True)
                # Find context/source in the next <dl> sibling (if any)
                context = None
                j = i + 1
                while j < len(elements):
                    sib = elements[j]
                    if getattr(sib, 'name', None) == 'dl':
                        context = ' '.join(dd.get_text(strip=True) for dd in sib.find_all('dd'))
                        break
                    elif getattr(sib, 'name', None) not in [None, 'dl']:
                        break
                    j += 1
                # Só pega frases que têm contexto
                if context and 20 < len(quote_text) < 350 and not quote_text.startswith('[') and not quote_text.lower().startswith('ver também'):
                    quote_text = normalize_quote_text(quote_text)
                    quotes.append({
                        'text': quote_text,
                        'author': author_name,
                        'theme': theme,
                        'context': context,
                        'source': source,
                        'lang': lang
                    })
        i += 1
    return quotes

def fetch_quotes_from_wikiquote(author_url, author_name, theme=None, lang='pt'):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
    resp = requests.get(author_url, headers=headers)
    soup = BeautifulSoup(resp.text, 'html.parser')
    quotes = fetch_quotes_from_html(soup, author_name, theme, lang, source=author_url)
    # Não adiciona frases sem contexto
    return quotes

def fetch_quotes_from_local_html(html_path, author_name, theme=None, lang='pt', source=None):
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    return fetch_quotes_from_html(soup, author_name, theme, lang, source=source)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Extrai citações de Wikiquote (online ou HTML local)')
    parser.add_argument('--local-html', type=str, help='Caminho para arquivo HTML salvo do Wikiquote')
    parser.add_argument('--author', type=str, help='Nome do autor')
    parser.add_argument('--theme', type=str, help='Tema principal')
    parser.add_argument('--lang', type=str, default='pt', help='Idioma')
    parser.add_argument('--source', type=str, help='Fonte/URL original')
    args = parser.parse_args()

    all_quotes = []
    if args.local_html and args.author:
        print(f'Coletando frases de {args.author} do arquivo local...')
        quotes = fetch_quotes_from_local_html(args.local_html, args.author, args.theme, args.lang, args.source)
        print(f'  {len(quotes)} frases coletadas.')
        all_quotes.extend(quotes)
    else:
        # Lista de 20 filósofos e 20 grandes pensadores
        authors = [
            # 20 filósofos (substituídos os que não retornaram frases)
            {'name': 'Immanuel Kant', 'url': 'https://pt.wikiquote.org/wiki/Immanuel_Kant', 'theme': 'idealismo'},
            {'name': 'Simone de Beauvoir', 'url': 'https://pt.wikiquote.org/wiki/Simone_de_Beauvoir', 'theme': 'feminismo'},
            {'name': 'Baruch Spinoza', 'url': 'https://pt.wikiquote.org/wiki/Baruch_Spinoza', 'theme': 'racionalismo'},
            {'name': 'David Hume', 'url': 'https://pt.wikiquote.org/wiki/David_Hume', 'theme': 'empirismo'},
            {'name': 'John Locke', 'url': 'https://pt.wikiquote.org/wiki/John_Locke', 'theme': 'empirismo'},
            {'name': 'Thomas Hobbes', 'url': 'https://pt.wikiquote.org/wiki/Thomas_Hobbes', 'theme': 'contratualismo'},
            {'name': 'Ludwig Wittgenstein', 'url': 'https://pt.wikiquote.org/wiki/Ludwig_Wittgenstein', 'theme': 'linguagem'},
            {'name': 'Arthur Schopenhauer', 'url': 'https://pt.wikiquote.org/wiki/Arthur_Schopenhauer', 'theme': 'pessimismo'},
            {'name': 'Heráclito', 'url': 'https://pt.wikiquote.org/wiki/Her%C3%A1clito', 'theme': 'filosofia pré-socrática'},
            {'name': 'Plotino', 'url': 'https://pt.wikiquote.org/wiki/Plotino', 'theme': 'neoplatonismo'},
            {'name': 'Epicuro', 'url': 'https://pt.wikiquote.org/wiki/Epicuro', 'theme': 'hedonismo'},
            {'name': 'Blaise Pascal', 'url': 'https://pt.wikiquote.org/wiki/Blaise_Pascal', 'theme': 'matemática e filosofia'},
            {'name': 'Francis Bacon', 'url': 'https://pt.wikiquote.org/wiki/Francis_Bacon', 'theme': 'ciência e filosofia'},
            {'name': 'Voltaire', 'url': 'https://pt.wikiquote.org/wiki/Voltaire', 'theme': 'iluminismo'},
            {'name': 'John Stuart Mill', 'url': 'https://pt.wikiquote.org/wiki/John_Stuart_Mill', 'theme': 'utilitarismo'},
            {'name': 'Santo Agostinho', 'url': 'https://pt.wikiquote.org/wiki/Agostinho_de_Hipona', 'theme': 'patrística'},
            {'name': 'Epicuro de Samos', 'url': 'https://pt.wikiquote.org/wiki/Epicuro_de_Samos', 'theme': 'hedonismo'},
            {'name': 'Søren Kierkegaard', 'url': 'https://pt.wikiquote.org/wiki/S%C3%B8ren_Kierkegaard', 'theme': 'existencialismo'},
            {'name': 'Hannah Arendt', 'url': 'https://pt.wikiquote.org/wiki/Hannah_Arendt', 'theme': 'filosofia política'},
            {'name': 'Augusto Cury', 'url': 'https://pt.wikiquote.org/wiki/Augusto_Cury', 'theme': 'psicologia e filosofia'},

            # 20 grandes pensadores (substituídos os que não retornaram frases)
            {'name': 'Sigmund Freud', 'url': 'https://pt.wikiquote.org/wiki/Sigmund_Freud', 'theme': 'psicanálise'},
            {'name': 'Charles Darwin', 'url': 'https://pt.wikiquote.org/wiki/Charles_Darwin', 'theme': 'evolução'},
            {'name': 'Isaac Newton', 'url': 'https://pt.wikiquote.org/wiki/Isaac_Newton', 'theme': 'ciência'},
            {'name': 'Galileu Galilei', 'url': 'https://pt.wikiquote.org/wiki/Galileu_Galilei', 'theme': 'ciência'},
            {'name': 'Marie Curie', 'url': 'https://pt.wikiquote.org/wiki/Marie_Curie', 'theme': 'ciência'},
            {'name': 'Leonardo da Vinci', 'url': 'https://pt.wikiquote.org/wiki/Leonardo_da_Vinci', 'theme': 'arte e ciência'},
            {'name': 'Stephen Hawking', 'url': 'https://pt.wikiquote.org/wiki/Stephen_Hawking', 'theme': 'cosmologia'},
            {'name': 'Confúcio', 'url': 'https://pt.wikiquote.org/wiki/Conf%C3%BAcio', 'theme': 'filosofia chinesa'},
            {'name': 'Martin Luther King', 'url': 'https://pt.wikiquote.org/wiki/Martin_Luther_King', 'theme': 'direitos civis'},
            {'name': 'Nelson Mandela', 'url': 'https://pt.wikiquote.org/wiki/Nelson_Mandela', 'theme': 'direitos humanos'},
            {'name': 'Buda', 'url': 'https://pt.wikiquote.org/wiki/Buda', 'theme': 'budismo'},
            {'name': 'Thomas Edison', 'url': 'https://pt.wikiquote.org/wiki/Thomas_Edison', 'theme': 'invenção'},
            {'name': 'Benjamin Franklin', 'url': 'https://pt.wikiquote.org/wiki/Benjamin_Franklin', 'theme': 'política e ciência'},
            {'name': 'Johann Wolfgang von Goethe', 'url': 'https://pt.wikiquote.org/wiki/Johann_Wolfgang_von_Goethe', 'theme': 'literatura'},
            {'name': 'Cecília Meireles', 'url': 'https://pt.wikiquote.org/wiki/Cec%C3%ADlia_Meireles', 'theme': 'literatura brasileira'},
            {'name': 'Carlos Drummond de Andrade', 'url': 'https://pt.wikiquote.org/wiki/Carlos_Drummond_de_Andrade', 'theme': 'literatura brasileira'},
            {'name': 'George Bernard Shaw', 'url': 'https://pt.wikiquote.org/wiki/George_Bernard_Shaw', 'theme': 'literatura'},
            {'name': 'Ralph Waldo Emerson', 'url': 'https://pt.wikiquote.org/wiki/Ralph_Waldo_Emerson', 'theme': 'filosofia e literatura'},
            {'name': 'Paulo Freire', 'url': 'https://pt.wikiquote.org/wiki/Paulo_Freire', 'theme': 'educação'},
            {'name': 'Mark Twain', 'url': 'https://pt.wikiquote.org/wiki/Mark_Twain', 'theme': 'literatura'}
        ]
        for a in authors:
            print(f'Coletando frases de {a["name"]}...')
            quotes = fetch_quotes_from_wikiquote(a['url'], a['name'], a['theme'])
            print(f'  {len(quotes)} frases coletadas.')
            all_quotes.extend(quotes)
    # Salva em JSON
    with open('quotes_wikiquote.json', 'w', encoding='utf-8') as f:
        json.dump(all_quotes, f, ensure_ascii=False, indent=2)
    print(f'Total de frases coletadas: {len(all_quotes)}')
