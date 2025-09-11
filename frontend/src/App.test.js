import { render, screen } from '@testing-library/react';
import App from './App';

// Автотест 1 тестовый
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
test('renders learn react link', () => {
  
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});