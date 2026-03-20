MAIN = main
LATEX = xelatex -interaction=nonstopmode -shell-escape
BIBER = biber
PYTHON = python3

# minted v3 (TeX Live 2025+) requires TEXMF_OUTPUT_DIRECTORY for output
export TEXMF_OUTPUT_DIRECTORY = .

.PHONY: build clean cleanall typo typo-apply

# Build: 3× xelatex + biber + typo-apply.
build: typo-apply
	$(LATEX) $(MAIN).tex
	$(BIBER) $(MAIN)
	$(LATEX) $(MAIN).tex
	$(LATEX) $(MAIN).tex

clean:
	find . -name '*.aux' -delete
	rm -f $(MAIN).bbl $(MAIN).bcf $(MAIN).blg \
	      $(MAIN).log $(MAIN).out $(MAIN).toc $(MAIN).run.xml \
	      $(MAIN).lof $(MAIN).lot $(MAIN).logrf $(MAIN).idx \
	      $(MAIN).acn $(MAIN).acr $(MAIN).alg \
	      $(MAIN).glg $(MAIN).glo $(MAIN).gls
	rm -rf _minted _minted-$(MAIN) *.config.minted

cleanall: clean
	rm -f $(MAIN).pdf

typo:
	$(PYTHON) tools/typo_fix.py

typo-apply:
	$(PYTHON) tools/typo_fix.py --apply
