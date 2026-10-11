MAIN = main
LATEX = xelatex -interaction=nonstopmode -shell-escape
PYTHON = python3

BIBER_SYS := $(shell command -v biber)
BIBER := $(shell test -x "$(BIBER_SYS)" && "$(BIBER_SYS)" --version >/dev/null 2>&1 \
                 && echo "$(BIBER_SYS)" || echo .cache/biber)
BIBER_DEP := $(filter .cache/biber,$(BIBER))

# minted v3 (TeX Live 2025+) requires TEXMF_OUTPUT_DIRECTORY for output
export TEXMF_OUTPUT_DIRECTORY = .

.PHONY: build draft watch diagrams clean cleanall typo typo-apply

# Build: 3× xelatex + biber + typo-apply.
build: typo-apply $(BIBER_DEP) diagrams
	$(LATEX) $(MAIN).tex
	$(BIBER) $(MAIN)
	$(LATEX) $(MAIN).tex
	$(LATEX) $(MAIN).tex

.cache/biber: $(BIBER_SYS)
	@test -n "$<" || { echo "biber required (TeX Live)"; exit 1; }
	@mkdir -p $(@D)
	lipo "$<" -thin $$(uname -m) -output $@ && chmod +x $@

# Draft: 1× xelatex + typo-apply without biber.
draft: typo-apply
	$(LATEX) $(MAIN).tex

# PDF diagram: make diagrams/<name>.pdf, all: make diagrams.
DIAGRAMS := $(patsubst %.tex,%.pdf,$(filter-out diagrams/_%,$(wildcard diagrams/*.tex)))
diagrams: $(DIAGRAMS)

diagrams/%.pdf: diagrams/%.tex diagrams/_render.tex diagrams/_setup.tex parts/macros.tex
	xelatex -interaction=nonstopmode -halt-on-error -output-directory=diagrams -jobname=$* "\def\diagram{$*}\input{diagrams/_render}" \
	  && rm -f diagrams/$*.aux diagrams/$*.log

# Continuous watch: without typo-fix
watch:
	@command -v latexmk >/dev/null 2>&1 || { echo "latexmk required (TeX Live)"; exit 1; }
	@echo "Continuous compilation. Ctrl+C to stop."
	@latexmk -pvc -view=none -xelatex -shell-escape -interaction=nonstopmode $(MAIN).tex

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
