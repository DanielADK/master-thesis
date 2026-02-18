MAIN = main
LATEX = xelatex -interaction=nonstopmode
BIBER = biber
PYTHON = python3

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

cleanall: clean
	rm -f $(MAIN).pdf

typo:
	$(PYTHON) tools/typo_fix.py

typo-apply:
	$(PYTHON) tools/typo_fix.py --apply
