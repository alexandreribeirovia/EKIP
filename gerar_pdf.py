#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para converter o relatório de testes Markdown para PDF
"""

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    import re
except ImportError:
    print("ReportLab não está instalado. Instalando...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    import re

def markdown_to_pdf(md_file, pdf_file):
    """Converte arquivo Markdown para PDF"""
    
    # Ler o arquivo Markdown
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Criar documento PDF
    doc = SimpleDocTemplate(pdf_file, pagesize=A4,
                            rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=18)
    
    # Container para elementos do PDF
    elements = []
    
    # Estilos
    styles = getSampleStyleSheet()
    
    # Estilos customizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#FF6600'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#FF6600'),
        spaceAfter=12,
        spaceBefore=20,
        fontName='Helvetica-Bold'
    )
    
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=10,
        spaceBefore=15,
        fontName='Helvetica-Bold'
    )
    
    heading3_style = ParagraphStyle(
        'CustomHeading3',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#666666'),
        spaceAfter=8,
        spaceBefore=12,
        fontName='Helvetica-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#000000'),
        spaceAfter=6,
        alignment=TA_JUSTIFY
    )
    
    # Processar linhas
    lines = content.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # Título principal
        if line.startswith('# ') and i == 0:
            title = line[2:].strip()
            elements.append(Paragraph(title, title_style))
            elements.append(Spacer(1, 0.2*inch))
            i += 1
            continue
        
        # Heading 1
        if line.startswith('## '):
            text = line[3:].strip()
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Paragraph(text, heading1_style))
            i += 1
            continue
        
        # Heading 2
        if line.startswith('### '):
            text = line[4:].strip()
            elements.append(Paragraph(text, heading2_style))
            i += 1
            continue
        
        # Heading 3
        if line.startswith('#### '):
            text = line[5:].strip()
            elements.append(Paragraph(text, heading3_style))
            i += 1
            continue
        
        # Lista com checkmarks
        if line.startswith('- **') or line.startswith('| '):
            if line.startswith('| '):
                # Tabela
                table_data = []
                header = []
                while i < len(lines) and lines[i].strip().startswith('|'):
                    row = [cell.strip() for cell in lines[i].strip().split('|')[1:-1]]
                    if not header:
                        header = row
                    else:
                        table_data.append(row)
                    i += 1
                if table_data:
                    table = Table([header] + table_data)
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FF6600')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                        ('GRID', (0, 0), (-1, -1), 1, colors.black),
                        ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ]))
                    elements.append(table)
                    elements.append(Spacer(1, 0.1*inch))
                continue
            else:
                # Lista normal
                text = line[2:].strip()
                # Converter checkmarks
                text = text.replace('✅', '✓')
                text = text.replace('**', '<b>', 1).replace('**', '</b>', 1)
                elements.append(Paragraph(f"• {text}", normal_style))
                i += 1
                continue
        
        # Linha separadora
        if line.startswith('---'):
            elements.append(Spacer(1, 0.2*inch))
            i += 1
            continue
        
        # Texto normal
        if line:
            # Processar formatação inline
            text = line
            text = text.replace('**', '<b>', 1).replace('**', '</b>', 1)
            text = text.replace('✅', '✓')
            text = text.replace('`', '<font name="Courier">').replace('`', '</font>', 1)
            elements.append(Paragraph(text, normal_style))
        
        i += 1
    
    # Construir PDF
    doc.build(elements)
    print(f"PDF gerado com sucesso: {pdf_file}")

if __name__ == "__main__":
    markdown_to_pdf("RELATORIO_TESTES_EKIP.md", "RELATORIO_TESTES_EKIP.pdf")








