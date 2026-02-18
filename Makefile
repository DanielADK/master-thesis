MAIN = main
LATEX = xelatex -interaction=nonstopmode
BIBER = biber

.PHONY: build clean cleanall

build:
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
