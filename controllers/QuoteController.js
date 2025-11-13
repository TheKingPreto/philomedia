import Quote from '../models/Quote.js';

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export const getAllQuotes = asyncHandler(async (req, res, next) => {
    const quotes = await Quote.find({});
    res.status(200).json(quotes);
});

export const getQuoteById = asyncHandler(async (req, res, next) => {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
        return res.status(404).json({ message: 'Quote not found.' });
    }
    res.status(200).json(quote);
});

export const createQuote = asyncHandler(async (req, res, next) => {
    const newQuote = new Quote(req.body);
    const savedQuote = await newQuote.save();
    res.status(201).json(savedQuote);
});

export const updateQuote = asyncHandler(async (req, res, next) => {
    const updatedQuote = await Quote.findByIdAndUpdate(
        req.params.id, 
        req.body, 
        { new: true, runValidators: true }
    );
    if (!updatedQuote) {
        return res.status(404).json({ message: 'Quote not found for update.' });
    }
    res.status(200).json(updatedQuote);
});

export const deleteQuote = asyncHandler(async (req, res, next) => {
    const deletedQuote = await Quote.findByIdAndDelete(req.params.id);

    if (!deletedQuote) {
        return res.status(404).json({ message: 'Quote not found for deletion.' });
    }
    res.status(200).json({ message: 'Quote successfully deleted.' });
});